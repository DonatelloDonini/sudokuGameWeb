const {test, describe, beforeEach, afterEach}= require("node:test");
const assert= require("node:assert/strict");
const WebSocket= require("ws");
const {openDatabase}= require("../src/database");
const {Users}= require("../src/users");
const {BattleManager, SEARCH_WINDOW_STEP_MS}= require("../src/battle/BattleManager");
const {eloChange, expectedScore, difficultyForElo}= require("../src/battle/elo");
const {startServer, createClient, SOLUTION, copy}= require("./helpers");

/** The puzzle used by the battles: the fixed solution with the first two rows emptied. */
const PUZZLE= SOLUTION.map((row, y)=> y< 2 ? new Array(9).fill(null) : [...row]);

/** A connection that records what the server sends. */
const fakeConnection= ()=> {
  const messages= [];
  return {
    messages,
    closed: false,
    send(message){
      messages.push(message);
    },
    close(){
      this.closed= true;
    },
    last(type){
      return messages.filter(message=> message.type=== type).at(-1);
    },
  };
};

/** Fills the battle board of a player with the solution, stopping `missing` cells before the end. */
const playSolution= (manager, userId, missing= 0)=> {
  const cells= [];
  PUZZLE.forEach((row, y)=> row.forEach((cell, x)=> {
    if (cell=== null) cells.push({x, y});
  }));
  for (const {x, y} of cells.slice(0, cells.length - missing)){
    manager.handleMessage(userId, {type: "move", x, y, value: SOLUTION[y][x]});
  }
};

describe("elo", ()=> {
  test("equal players exchange half of K", ()=> {
    assert.equal(expectedScore(1200, 1200), .5);
    assert.equal(eloChange(1200, 1200), 16);
  });

  test("beating a stronger player is worth more", ()=> {
    assert.ok(eloChange(1100, 1400)> eloChange(1400, 1100));
    assert.ok(eloChange(2000, 1000)>= 1);
  });

  test("better players get harder levels", ()=> {
    assert.equal(difficultyForElo(1000), "easy");
    assert.equal(difficultyForElo(1200), "medium");
    assert.equal(difficultyForElo(1400), "hard");
    assert.equal(difficultyForElo(1600), "expert");
  });
});

describe("BattleManager", ()=> {
  let db, users, manager, clock, alice, bob;

  beforeEach(()=> {
    db= openDatabase(":memory:");
    users= new Users(db);
    clock= 1_000_000;
    manager= new BattleManager({
      db,
      users,
      now: ()=> clock,
      countdownMs: 3000,
      reconnectGraceMs: 20000,
      generate: (difficulty)=> ({difficulty, puzzle: copy(PUZZLE), solution: copy(SOLUTION)}),
    });

    alice= {user: users.create("alice", "x"), connection: fakeConnection()};
    bob= {user: users.create("bob", "x"), connection: fakeConnection()};
    manager.connect(alice.user, alice.connection);
    manager.connect(bob.user, bob.connection);
  });

  afterEach(()=> {
    manager.stop();
    db.close();
  });

  /** Queues both players (same elo) and lets the countdown run out. */
  const startBattle= ()=> {
    manager.handleMessage(alice.user.id, {type: "join-queue"});
    manager.handleMessage(bob.user.id, {type: "join-queue"});
    clock+= 3000;
  };

  test("players with the same elo are matched immediately with the same level", ()=> {
    startBattle();

    const aliceStart= alice.connection.last("battle-start");
    const bobStart= bob.connection.last("battle-start");
    assert.ok(aliceStart && bobStart);
    assert.equal(aliceStart.battleId, bobStart.battleId);
    assert.deepEqual(aliceStart.puzzle, bobStart.puzzle);
    assert.equal(aliceStart.startsInMs, 3000);
    assert.equal(aliceStart.difficulty, "medium");
    assert.equal(aliceStart.opponent.username, "bob");
    assert.equal(aliceStart.solution, undefined, "the solution is not sent before the end");
  });

  test("players with different elo wait until the search window is wide enough", ()=> {
    users.setElo(bob.user.id, 1260);
    manager.handleMessage(alice.user.id, {type: "join-queue"});
    manager.handleMessage(bob.user.id, {type: "join-queue"});
    assert.equal(alice.connection.last("battle-start"), undefined);

    clock+= SEARCH_WINDOW_STEP_MS * 2;
    manager.matchPlayers();
    assert.equal(alice.connection.last("battle-start"), undefined, "a 50 points window is not enough for 60 points");

    clock+= SEARCH_WINDOW_STEP_MS;
    manager.matchPlayers();
    assert.ok(alice.connection.last("battle-start"));
  });

  test("leaving the queue prevents the match", ()=> {
    manager.handleMessage(alice.user.id, {type: "join-queue"});
    manager.handleMessage(alice.user.id, {type: "leave-queue"});
    manager.handleMessage(bob.user.id, {type: "join-queue"});
    assert.equal(bob.connection.last("battle-start"), undefined);
  });

  test("moves are refused during the countdown and on given cells", ()=> {
    manager.handleMessage(alice.user.id, {type: "join-queue"});
    manager.handleMessage(bob.user.id, {type: "join-queue"});

    manager.handleMessage(alice.user.id, {type: "move", x: 0, y: 0, value: 5});
    assert.match(alice.connection.last("error").message, /started/);

    clock+= 3000;
    manager.handleMessage(alice.user.id, {type: "move", x: 0, y: 5, value: 1});
    assert.match(alice.connection.last("error").message, /given/);

    manager.handleMessage(alice.user.id, {type: "move", x: 9, y: 0, value: 1});
    assert.match(alice.connection.last("error").message, /Invalid/);
  });

  test("the opponent sees the progress, the first to solve wins and the elo changes", ()=> {
    startBattle();

    playSolution(manager, bob.user.id, 5);
    assert.deepEqual(alice.connection.last("opponent-progress"), {type: "opponent-progress", filled: 13, total: 18});

    clock+= 60_000;
    playSolution(manager, alice.user.id);

    const aliceEnd= alice.connection.last("battle-end");
    const bobEnd= bob.connection.last("battle-end");
    assert.equal(aliceEnd.result, "win");
    assert.equal(aliceEnd.reason, "solved");
    assert.equal(aliceEnd.eloChange, 16);
    assert.equal(aliceEnd.elo, 1216);
    assert.equal(aliceEnd.durationMs, 60_000);
    assert.deepEqual(aliceEnd.solution, SOLUTION);
    assert.equal(bobEnd.result, "loss");
    assert.equal(bobEnd.elo, 1184);

    assert.equal(users.findById(alice.user.id).elo, 1216);
    assert.equal(users.findById(bob.user.id).elo, 1184);

    const stored= db.prepare("SELECT * FROM battles").get();
    assert.equal(stored.winner_id, alice.user.id);
    assert.equal(stored.end_reason, "solved");
    assert.equal(stored.elo_change, 16);
    assert.deepEqual(users.toPublic(users.findById(alice.user.id)), {
      id: alice.user.id, username: "alice", elo: 1216, battlesPlayed: 1, battlesWon: 1, battlesLost: 0, gamesCompleted: 0,
    });
  });

  test("a full but wrong board doesn't win", ()=> {
    startBattle();
    playSolution(manager, alice.user.id, 1);
    manager.handleMessage(alice.user.id, {type: "move", x: 8, y: 1, value: SOLUTION[1][8]=== 9 ? 1 : 9});

    assert.ok(alice.connection.last("board-incorrect"));
    assert.equal(alice.connection.last("battle-end"), undefined);
  });

  test("resigning gives the win to the opponent", ()=> {
    startBattle();
    manager.handleMessage(bob.user.id, {type: "resign"});

    assert.equal(alice.connection.last("battle-end").result, "win");
    assert.equal(alice.connection.last("battle-end").reason, "resign");
    assert.equal(bob.connection.last("battle-end").result, "loss");
  });

  test("a player who comes back in time resumes the battle where they left it", ()=> {
    startBattle();
    playSolution(manager, bob.user.id, 10);

    manager.disconnect(bob.user.id, bob.connection);
    assert.deepEqual(alice.connection.last("opponent-connection"), {type: "opponent-connection", connected: false, graceMs: 20000});

    const newConnection= fakeConnection();
    manager.connect(bob.user, newConnection);
    const resumed= newConnection.last("battle-start");
    assert.equal(resumed.board.flat().filter(cell=> cell=== null).length, 10);
    assert.equal(alice.connection.last("opponent-connection").connected, true);
  });

  test("a player who doesn't come back loses", async (t)=> {
    t.mock.timers.enable({apis: ["setTimeout"]});
    startBattle();

    manager.disconnect(bob.user.id, bob.connection);
    t.mock.timers.tick(20000);

    assert.equal(alice.connection.last("battle-end").result, "win");
    assert.equal(alice.connection.last("battle-end").reason, "disconnect");
  });

  test("opening a second window replaces the first connection", ()=> {
    const secondWindow= fakeConnection();
    manager.connect(alice.user, secondWindow);

    assert.ok(alice.connection.last("replaced"));
    assert.equal(alice.connection.closed, true);

    // the old connection closing must not drop the new one
    manager.disconnect(alice.user.id, alice.connection);
    manager.handleMessage(alice.user.id, {type: "join-queue"});
    assert.ok(secondWindow.last("queue-joined"));
  });

  test("a player can't queue while in a battle", ()=> {
    startBattle();
    manager.handleMessage(alice.user.id, {type: "join-queue"});
    assert.match(alice.connection.last("error").message, /already in a battle/);
  });
});

describe("battle websocket", ()=> {
  let server;

  beforeEach(async ()=> {
    server= await startServer();
  });

  afterEach(()=> server.close());

  const wsUrl= ()=> server.baseUrl.replace("http", "ws") + "/ws";

  /** Opens a websocket and collects its messages. */
  const openSocket= (cookie, headers= {})=> new Promise((resolve, reject)=> {
    const socket= new WebSocket(wsUrl(), {headers: {Cookie: cookie, ...headers}});
    const messages= [];
    const waiters= [];
    socket.on("message", (data)=> {
      const message= JSON.parse(data);
      messages.push(message);
      waiters.filter(waiter=> waiter.type=== message.type).forEach(waiter=> waiter.resolve(message));
    });
    socket.waitFor= (type)=> {
      const existing= messages.find(message=> message.type=== type);
      return existing ? Promise.resolve(existing) : new Promise(done=> waiters.push({type, resolve: done}));
    };
    socket.on("open", ()=> resolve(socket));
    socket.on("unexpected-response", (req, res)=> reject(new Error(`HTTP ${res.statusCode}`)));
    socket.on("error", reject);
  });

  const loggedIn= async (username)=> {
    const client= createClient(server.baseUrl);
    await client.post("/api/auth/register", {username, password: "secret1"});
    return client;
  };

  test("guests can't connect", async ()=> {
    await assert.rejects(openSocket(""), /HTTP 401/);
  });

  test("connections from other sites are refused", async ()=> {
    const client= await loggedIn("origin_check");
    await assert.rejects(openSocket(client.cookie, {Origin: "https://evil.example"}), /HTTP 403/);
  });

  test("two players get matched and play a battle", async ()=> {
    const [aliceClient, bobClient]= await Promise.all([loggedIn("ws_alice"), loggedIn("ws_bob")]);
    const aliceSocket= await openSocket(aliceClient.cookie, {Origin: server.baseUrl});
    const bobSocket= await openSocket(bobClient.cookie);

    assert.equal((await aliceSocket.waitFor("welcome")).elo, 1200);

    aliceSocket.send(JSON.stringify({type: "join-queue"}));
    bobSocket.send(JSON.stringify({type: "join-queue"}));
    const start= await aliceSocket.waitFor("battle-start");
    assert.equal(start.opponent.username, "ws_bob");

    bobSocket.send(JSON.stringify({type: "resign"}));
    const end= await aliceSocket.waitFor("battle-end");
    assert.equal(end.result, "win");
    assert.equal(end.elo, 1216);

    const {body}= await aliceClient.get("/api/leaderboard/elo");
    assert.deepEqual(body.players.map(player=> [player.username, player.elo, player.wins, player.losses]), [
      ["ws_alice", 1216, 1, 0],
      ["ws_bob", 1184, 0, 1],
    ]);

    aliceSocket.close();
    bobSocket.close();
  });

  test("invalid messages get an error instead of crashing the server", async ()=> {
    const client= await loggedIn("ws_garbage");
    const socket= await openSocket(client.cookie);
    socket.send("not json");
    assert.match((await socket.waitFor("error")).message, /JSON/);
    socket.close();
  });
});
