const crypto= require("node:crypto");
const {generateLevel}= require("../levelGenerator");
const {transaction}= require("../database");
const {boardsEqual, copyBoard, countEmpty}= require("../boards");
const {eloChange, difficultyForElo}= require("./elo");

/**
 * Matchmaking: players are only matched with someone with exactly their elo at first,
 * then the accepted gap grows the longer they wait, so nobody waits forever.
 */
const SEARCH_WINDOW_STEP= 25;
const SEARCH_WINDOW_STEP_MS= 5 * 1000;
const MAX_SEARCH_WINDOW= 400;

/**
 * Keeps the matchmaking queue and the running battles in memory, and stores finished battles in the database.\
 * It doesn't know about websockets: each player is reached through a connection object with send(message) and close().
 *
 * Messages from the client: join-queue, leave-queue, move {x, y, value}, resign.\
 * Messages to the client: welcome, queue-joined, queue-left, battle-start, opponent-progress,
 * opponent-connection, board-incorrect, battle-end, replaced (the user connected from another window), error.
 */
class BattleManager{
  /**
   * @param {Object} options
   * @param {import("node:sqlite").DatabaseSync} options.db
   * @param {import("../users").Users} options.users
   * @param {Function} [options.generate] Level generator, replaceable in tests.
   * @param {Function} [options.now] Returns the current time in ms, replaceable in tests.
   * @param {number} [options.countdownMs] Time between the match and the start of the battle.
   * @param {number} [options.reconnectGraceMs] How long a disconnected player has to come back before losing.
   * @param {number} [options.matchIntervalMs] How often the queue is checked for new matches.
   */
  constructor({db, users, generate= generateLevel, now= Date.now, countdownMs= 3000, reconnectGraceMs= 20000, matchIntervalMs= 1000}){
    this.db= db;
    this.users= users;
    this.generate= generate;
    this.now= now;
    this.countdownMs= countdownMs;
    this.reconnectGraceMs= reconnectGraceMs;
    this.matchIntervalMs= matchIntervalMs;

    /** @type {Map<number, {send: Function, close: Function}>} userId -> connection */
    this.connections= new Map();
    /** @type {Map<number, {userId: number, elo: number, joinedAt: number}>} userId -> queue entry */
    this.queue= new Map();
    /** @type {Map<number, Object>} userId -> battle */
    this.battlesByUser= new Map();
  }

  start(){
    this.matchInterval= setInterval(()=> this.matchPlayers(), this.matchIntervalMs);
    this.matchInterval.unref();
  }

  stop(){
    clearInterval(this.matchInterval);
    for (const battle of new Set(this.battlesByUser.values())){
      battle.players.forEach(player=> clearTimeout(player.graceTimer));
    }
  }

  //////             //////
  ////// connections //////
  //////             //////

  connect(user, connection){
    const previousConnection= this.connections.get(user.id);
    if (previousConnection){
      previousConnection.send({type: "replaced"});
      previousConnection.close();
    }
    this.connections.set(user.id, connection);

    connection.send({type: "welcome", elo: this.users.findById(user.id).elo});

    const battle= this.battlesByUser.get(user.id);
    if (battle){
      const player= this._player(battle, user.id);
      clearTimeout(player.graceTimer);
      player.graceTimer= null;

      connection.send(this._battleStartMessage(battle, user.id));
      this._send(this._opponent(battle, user.id).userId, {type: "opponent-connection", connected: true});
    }
  }

  disconnect(userId, connection){
    // a newer connection already replaced this one
    if (this.connections.get(userId)!== connection) return;

    this.connections.delete(userId);
    this.queue.delete(userId);

    const battle= this.battlesByUser.get(userId);
    if (battle){
      const player= this._player(battle, userId);
      const opponent= this._opponent(battle, userId);
      this._send(opponent.userId, {type: "opponent-connection", connected: false, graceMs: this.reconnectGraceMs});

      player.graceTimer= setTimeout(()=> this._finish(battle, opponent.userId, "disconnect"), this.reconnectGraceMs);
      player.graceTimer.unref?.();
    }
  }

  handleMessage(userId, message){
    switch (message?.type){
      case "join-queue": return this._joinQueue(userId);
      case "leave-queue": return this._leaveQueue(userId);
      case "move": return this._move(userId, message);
      case "resign": return this._resign(userId);
      default: return this._error(userId, "Unknown message type.");
    }
  }

  //////             //////
  ////// matchmaking //////
  //////             //////

  /**
   * @returns {number} The maximum elo gap a queued player accepts right now.
   */
  searchWindow(entry, now= this.now()){
    const steps= Math.floor((now - entry.joinedAt) / SEARCH_WINDOW_STEP_MS);
    return Math.min(MAX_SEARCH_WINDOW, steps * SEARCH_WINDOW_STEP);
  }

  _joinQueue(userId){
    if (this.battlesByUser.has(userId)) return this._error(userId, "You are already in a battle.");

    if (! this.queue.has(userId)){
      const {elo}= this.users.findById(userId);
      this.queue.set(userId, {userId, elo, joinedAt: this.now()});
    }

    this._send(userId, {type: "queue-joined", elo: this.queue.get(userId).elo});
    this.matchPlayers();
  }

  _leaveQueue(userId){
    this.queue.delete(userId);
    this._send(userId, {type: "queue-left"});
  }

  /**
   * Pairs the queued players whose elo gap is accepted by both of them, longest waiting first.
   */
  matchPlayers(){
    const now= this.now();
    const waiting= [...this.queue.values()].sort((a, b)=> a.joinedAt - b.joinedAt);
    const matched= new Set();

    for (let i= 0; i<waiting.length; i++){
      if (matched.has(waiting[i].userId)) continue;

      for (let j= i+1; j<waiting.length; j++){
        if (matched.has(waiting[j].userId)) continue;

        const gap= Math.abs(waiting[i].elo - waiting[j].elo);
        const acceptedGap= Math.min(this.searchWindow(waiting[i], now), this.searchWindow(waiting[j], now));
        if (gap<= acceptedGap){
          matched.add(waiting[i].userId);
          matched.add(waiting[j].userId);
          this._createBattle(waiting[i], waiting[j]);
          break;
        }
      }
    }
  }

  _createBattle(entryA, entryB){
    this.queue.delete(entryA.userId);
    this.queue.delete(entryB.userId);

    const difficulty= difficultyForElo((entryA.elo + entryB.elo) / 2);
    const {puzzle, solution}= this.generate(difficulty);

    const battle= {
      id: crypto.randomUUID(),
      difficulty,
      puzzle,
      solution,
      startsAt: this.now() + this.countdownMs,
      finished: false,
      players: [entryA, entryB].map(entry=> {
        const user= this.users.findById(entry.userId);
        return {
          userId: user.id,
          username: user.username,
          eloBefore: user.elo,
          board: copyBoard(puzzle),
          graceTimer: null,
        };
      }),
    };

    for (const player of battle.players){
      this.battlesByUser.set(player.userId, battle);
      this._send(player.userId, this._battleStartMessage(battle, player.userId));
    }

    return battle;
  }

  //////         //////
  ////// battles //////
  //////         //////

  _move(userId, {x, y, value}){
    const battle= this.battlesByUser.get(userId);
    if (! battle) return this._error(userId, "You are not in a battle.");
    if (this.now()< battle.startsAt) return this._error(userId, "The battle hasn't started yet.");

    const validCoord= (coord)=> Number.isInteger(coord) && coord>= 0 && coord< 9;
    const validValue= value=== null || (Number.isInteger(value) && value>= 1 && value<= 9);
    if (! validCoord(x) || ! validCoord(y) || ! validValue) return this._error(userId, "Invalid move.");
    if (battle.puzzle[y][x]!== null) return this._error(userId, "You can't change the given numbers.");

    const player= this._player(battle, userId);
    player.board[y][x]= value;

    this._send(this._opponent(battle, userId).userId, {type: "opponent-progress", ...this._progress(battle, player)});

    if (countEmpty(player.board)=== 0){
      if (boardsEqual(player.board, battle.solution)){
        this._finish(battle, userId, "solved");
      }
      else{
        this._send(userId, {type: "board-incorrect"});
      }
    }
  }

  _resign(userId){
    const battle= this.battlesByUser.get(userId);
    if (! battle) return this._error(userId, "You are not in a battle.");

    this._finish(battle, this._opponent(battle, userId).userId, "resign");
  }

  /**
   * Ends a battle, updates the elo of both players and stores the battle.
   * @param {Object} battle
   * @param {number} winnerId
   * @param {"solved"|"resign"|"disconnect"} reason
   */
  _finish(battle, winnerId, reason){
    if (battle.finished) return;
    battle.finished= true;

    const winner= this._player(battle, winnerId);
    const loser= this._opponent(battle, winnerId);
    const change= eloChange(winner.eloBefore, loser.eloBefore);
    const finishedAt= this.now();
    const [player1, player2]= battle.players;

    transaction(this.db, ()=> {
      this.users.setElo(winner.userId, winner.eloBefore + change);
      this.users.setElo(loser.userId, loser.eloBefore - change);
      this.db.prepare(`
        INSERT INTO battles (
          id, difficulty, puzzle, solution,
          player1_id, player2_id, player1_elo_before, player2_elo_before,
          winner_id, elo_change, end_reason, started_at, finished_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        battle.id, battle.difficulty, JSON.stringify(battle.puzzle), JSON.stringify(battle.solution),
        player1.userId, player2.userId, player1.eloBefore, player2.eloBefore,
        winner.userId, change, reason, battle.startsAt, finishedAt,
      );
    });

    for (const player of battle.players){
      clearTimeout(player.graceTimer);
      this.battlesByUser.delete(player.userId);

      const won= player=== winner;
      this._send(player.userId, {
        type: "battle-end",
        result: won ? "win" : "loss",
        reason,
        eloChange: won ? change : -change,
        elo: player.eloBefore + (won ? change : -change),
        durationMs: Math.max(0, finishedAt - battle.startsAt),
        solution: battle.solution,
      });
    }
  }

  //////         //////
  ////// helpers //////
  //////         //////

  _player(battle, userId){
    return battle.players.find(player=> player.userId=== userId);
  }

  _opponent(battle, userId){
    return battle.players.find(player=> player.userId!== userId);
  }

  /**
   * @returns {{filled: number, total: number}} How many of the empty cells the player filled.
   */
  _progress(battle, player){
    const total= countEmpty(battle.puzzle);
    return {filled: total - countEmpty(player.board), total};
  }

  _battleStartMessage(battle, userId){
    const player= this._player(battle, userId);
    const opponent= this._opponent(battle, userId);
    return {
      type: "battle-start",
      battleId: battle.id,
      difficulty: battle.difficulty,
      puzzle: battle.puzzle,
      board: player.board,
      startsInMs: battle.startsAt - this.now(),
      elo: player.eloBefore,
      opponent: {
        username: opponent.username,
        elo: opponent.eloBefore,
        connected: this.connections.has(opponent.userId),
        progress: this._progress(battle, opponent),
      },
    };
  }

  _send(userId, message){
    this.connections.get(userId)?.send(message);
  }

  _error(userId, message){
    this._send(userId, {type: "error", message});
  }
}

module.exports= {BattleManager, SEARCH_WINDOW_STEP, SEARCH_WINDOW_STEP_MS, MAX_SEARCH_WINDOW};
