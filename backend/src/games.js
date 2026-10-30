const crypto= require("node:crypto");
const {generateLevel}= require("./levelGenerator");
const {boardsEqual}= require("./boards");

/** Every hint adds this much to the final time. */
const HINT_PENALTY_MS= 30 * 1000;

/**
 * Single player games. The solution never leaves the server unless the player gives up,
 * so the times on the leaderboard can be trusted.
 */
class Games{
  /**
   * @param {import("node:sqlite").DatabaseSync} db
   * @param {Object} options
   * @param {Function} options.now Returns the current time in ms (replaceable in tests).
   */
  constructor(db, {now= Date.now}= {}){
    this.db= db;
    this.now= now;
  }

  /**
   * @param {number|null} userId null for guests.
   * @param {string} difficulty
   * @returns {Object} The game as stored.
   */
  create(userId, difficulty){
    const {puzzle, solution}= generateLevel(difficulty);
    const id= crypto.randomUUID();

    this.db.prepare(`
      INSERT INTO games (id, user_id, difficulty, puzzle, solution, started_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, userId, difficulty, JSON.stringify(puzzle), JSON.stringify(solution), this.now());

    return this.find(id);
  }

  /**
   * @param {string} id
   * @returns {Object|null} The game with puzzle and solution parsed, or null if it doesn't exist.
   */
  find(id){
    const row= this.db.prepare("SELECT * FROM games WHERE id = ?").get(id);
    if (! row) return null;

    return {
      ...row,
      puzzle: JSON.parse(row.puzzle),
      solution: JSON.parse(row.solution),
    };
  }

  /**
   * Picks a cell to reveal: a wrong number if the player made a mistake, an empty cell otherwise.
   * @param {Object} game
   * @param {list[list[number|null]]} board The player's board.
   * @returns {{x: number, y: number, value: number}|null} null if the board is already solved.
   */
  hint(game, board){
    const wrongCells= [];
    const emptyCells= [];
    for (let y= 0; y<9; y++){
      for (let x= 0; x<9; x++){
        if (board[y][x]=== null) emptyCells.push({x, y});
        else if (board[y][x]!== game.solution[y][x]) wrongCells.push({x, y});
      }
    }

    const candidates= wrongCells.length> 0 ? wrongCells : emptyCells;
    if (candidates.length=== 0) return null;

    const {x, y}= candidates[Math.floor(Math.random()*candidates.length)];
    this.db.prepare("UPDATE games SET hints_used = hints_used + 1 WHERE id = ?").run(game.id);

    return {x, y, value: game.solution[y][x]};
  }

  /**
   * Gives up the game: it won't count for the leaderboard.
   * @returns {list[list[number]]} The solution.
   */
  reveal(game){
    this.db
      .prepare("UPDATE games SET status = 'revealed', finished_at = ? WHERE id = ?")
      .run(this.now(), game.id);
    return game.solution;
  }

  /**
   * Checks the player's board and, if it is the solution, closes the game.
   * The time is measured on the server: from the creation of the game, plus the hint penalties.
   * @returns {{solved: false}|{solved: true, durationMs: number, hintsUsed: number}}
   */
  complete(game, board){
    if (! boardsEqual(board, game.solution)) return {solved: false};

    const finishedAt= this.now();
    const durationMs= (finishedAt - game.started_at) + game.hints_used*HINT_PENALTY_MS;
    this.db
      .prepare("UPDATE games SET status = 'completed', finished_at = ?, duration_ms = ? WHERE id = ?")
      .run(finishedAt, durationMs, game.id);

    return {solved: true, durationMs, hintsUsed: game.hints_used};
  }

  /**
   * @returns {number|null} The 1-based position of a completed game among the best times of its difficulty
   *                        (one entry per user), null for guests.
   */
  rankOf(game, durationMs){
    if (game.user_id=== null) return null;

    const {better}= this.db.prepare(`
      SELECT COUNT(*) AS better FROM (
        SELECT user_id, MIN(duration_ms) AS best
        FROM games
        WHERE status = 'completed' AND difficulty = ? AND user_id IS NOT NULL AND user_id != ?
        GROUP BY user_id
      ) WHERE best < ?
    `).get(game.difficulty, game.user_id, durationMs);

    return better + 1;
  }
}

module.exports= {Games, HINT_PENALTY_MS};
