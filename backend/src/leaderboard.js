const DEFAULT_LIMIT= 20;

/**
 * Players ranked by elo, among the ones who played at least one battle.
 * @param {import("node:sqlite").DatabaseSync} db
 * @returns {list[Object]}
 */
const eloLeaderboard= (db, limit= DEFAULT_LIMIT)=> db.prepare(`
  SELECT
    u.username,
    u.elo,
    COUNT(b.id)                        AS played,
    COALESCE(SUM(b.winner_id = u.id), 0) AS wins
  FROM users u
  JOIN battles b ON b.player1_id = u.id OR b.player2_id = u.id
  WHERE u.banned_at IS NULL
  GROUP BY u.id
  ORDER BY u.elo DESC, wins DESC, u.username
  LIMIT ?
`).all(limit).map(row=> ({...row, losses: row.played - row.wins}));

/**
 * Best single player time of each user on a difficulty.
 * @param {import("node:sqlite").DatabaseSync} db
 * @param {string} difficulty
 * @returns {list[Object]}
 */
const timesLeaderboard= (db, difficulty, limit= DEFAULT_LIMIT)=> db.prepare(`
  SELECT
    u.username,
    MIN(g.duration_ms) AS bestMs,
    COUNT(*)           AS completed
  FROM games g
  JOIN users u ON u.id = g.user_id
  WHERE g.status = 'completed' AND g.difficulty = ? AND u.banned_at IS NULL
  GROUP BY u.id
  ORDER BY bestMs, u.username
  LIMIT ?
`).all(difficulty, limit);

module.exports= {eloLeaderboard, timesLeaderboard};
