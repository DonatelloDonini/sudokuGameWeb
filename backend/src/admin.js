const fs= require("node:fs");
const {avatarCodeOf}= require("./avatars");

const DAY_MS= 24 * 60 * 60 * 1000;

/** The periods of the activity chart, in days (null: since the first day with data). */
const PERIODS= Object.freeze({week: 7, month: 30, year: 365, all: null});

const isoDay= (time)=> new Date(time).toISOString().slice(0, 10);

/**
 * The data of the admin dashboard.
 */
class AdminData{
  /**
   * @param {import("node:sqlite").DatabaseSync} db
   * @param {import("./users").Users} users
   * @param {Object} [options]
   * @param {Function} [options.now]
   * @param {string} [options.databasePath] To show the size of the database.
   */
  constructor(db, users, {now= Date.now, databasePath= null}= {}){
    this.db= db;
    this.users= users;
    this.now= now;
    this.databasePath= databasePath;
    this.startedAt= now();
  }

  /**
   * Totals, activity per day over the period and how the games are spread across the difficulties.
   * @param {string} period One of the PERIODS keys.
   */
  stats(period= "month"){
    const count= (sql, ...params)=> this.db.prepare(sql).get(...params).count;
    const today= isoDay(this.now());

    const totals= {
      users: count("SELECT COUNT(*) AS count FROM users"),
      bannedUsers: count("SELECT COUNT(*) AS count FROM users WHERE banned_at IS NOT NULL"),
      gamesStarted: count("SELECT COUNT(*) AS count FROM games"),
      gamesCompleted: count("SELECT COUNT(*) AS count FROM games WHERE status = 'completed'"),
      battles: count("SELECT COUNT(*) AS count FROM battles"),
      openReports: count("SELECT COUNT(*) AS count FROM reports WHERE status = 'open'"),
      activePlayersToday: count(`
        SELECT COUNT(*) AS count FROM (
          SELECT user_id FROM games WHERE user_id IS NOT NULL AND started_at >= ?
          UNION SELECT player1_id FROM battles WHERE started_at >= ?
          UNION SELECT player2_id FROM battles WHERE started_at >= ?
        )`, ...new Array(3).fill(Date.parse(today))),
    };

    // one entry per day, days without activity included
    const perDay= (sql)=> new Map(this.db.prepare(sql).all().map(row=> [row.day, row.count]));
    const games= perDay("SELECT date(started_at / 1000, 'unixepoch') AS day, COUNT(*) AS count FROM games GROUP BY day");
    const completed= perDay("SELECT date(finished_at / 1000, 'unixepoch') AS day, COUNT(*) AS count FROM games WHERE status = 'completed' GROUP BY day");
    const battles= perDay("SELECT date(started_at / 1000, 'unixepoch') AS day, COUNT(*) AS count FROM battles GROUP BY day");
    const newUsers= perDay("SELECT date(created_at / 1000, 'unixepoch') AS day, COUNT(*) AS count FROM users GROUP BY day");

    const days= PERIODS[period] ?? null;
    const firstDay= days!== null
      ? isoDay(this.now() - (days - 1) * DAY_MS)
      : [...games.keys(), ...battles.keys(), ...newUsers.keys(), today].sort()[0];

    const daily= [];
    for (let time= Date.parse(firstDay); isoDay(time)<= today; time+= DAY_MS){
      const day= isoDay(time);
      daily.push({
        date: day,
        games: games.get(day) ?? 0,
        completed: completed.get(day) ?? 0,
        battles: battles.get(day) ?? 0,
        newUsers: newUsers.get(day) ?? 0,
      });
    }

    const difficulties= this.db.prepare(`
      SELECT
        difficulty,
        COUNT(*) AS started,
        COALESCE(SUM(status = 'completed'), 0) AS completed,
        COALESCE(SUM(status = 'revealed'), 0) AS revealed,
        CAST(AVG(CASE WHEN status = 'completed' THEN duration_ms END) AS INTEGER) AS averageMs
      FROM games GROUP BY difficulty
    `).all();

    return {period, totals, daily, difficulties};
  }

  /**
   * @param {string} [search] Part of the username.
   */
  userList(search= ""){
    return this.db.prepare(`
      SELECT
        u.id, u.username, u.avatar, u.elo, u.created_at AS createdAt,
        u.is_admin = 1 AS isAdmin,
        u.banned_at AS bannedAt, u.ban_reason AS banReason,
        (SELECT COUNT(*) FROM games g WHERE g.user_id = u.id AND g.status = 'completed') AS gamesCompleted,
        (SELECT COUNT(*) FROM battles b WHERE b.player1_id = u.id OR b.player2_id = u.id) AS battles,
        (SELECT COUNT(*) FROM battles b WHERE b.winner_id = u.id) AS battlesWon,
        (SELECT COUNT(*) FROM reports r WHERE r.reported_id = u.id AND r.status = 'open') AS openReports
      FROM users u
      WHERE u.username LIKE ? ESCAPE '\\'
      ORDER BY u.created_at DESC
      LIMIT 500
    `).all(`%${search.replace(/[\\%_]/g, (char)=> `\\${char}`)}%`).map(user=> ({...user, isAdmin: user.isAdmin=== 1, avatar: avatarCodeOf(user)}));
  }

  recentBattles(){
    return this.db.prepare(`
      SELECT
        b.id, b.difficulty, b.hardest_technique AS hardestTechnique, b.end_reason AS endReason, b.elo_change AS eloChange,
        b.started_at AS startedAt, b.finished_at - b.started_at AS durationMs,
        p1.username AS player1, p2.username AS player2, w.username AS winner,
        (SELECT COUNT(*) FROM reports r WHERE r.battle_id = b.id) AS reports
      FROM battles b
      JOIN users p1 ON p1.id = b.player1_id
      JOIN users p2 ON p2.id = b.player2_id
      JOIN users w ON w.id = b.winner_id
      ORDER BY b.started_at DESC
      LIMIT 200
    `).all();
  }

  recentGames(){
    return this.db.prepare(`
      SELECT
        g.id, g.difficulty, g.status, g.hints_used AS hintsUsed, g.duration_ms AS durationMs,
        g.hardest_technique AS hardestTechnique, g.started_at AS startedAt,
        u.username
      FROM games g
      LEFT JOIN users u ON u.id = g.user_id
      ORDER BY g.started_at DESC
      LIMIT 200
    `).all();
  }

  /**
   * The state of the server.
   * @param {Object} runtime
   * @param {import("./battle/BattleManager").BattleManager} [runtime.battleManager]
   * @param {import("./levelPool").LevelPool} [runtime.levelPool]
   */
  system({battleManager= null, levelPool= null}= {}){
    let databaseBytes= null;
    if (this.databasePath){
      try {
        databaseBytes= fs.statSync(this.databasePath).size;
      }
      catch {}
    }

    return {
      uptimeMs: this.now() - this.startedAt,
      nodeVersion: process.version,
      memoryBytes: process.memoryUsage().rss,
      databaseBytes,
      battles: battleManager?.activity() ?? null,
      levelPool: levelPool
        ? {
          workerRunning: levelPool.worker!== null,
          queued: levelPool.queue.length,
          ready: Object.fromEntries(Object.entries(levelPool.levels).map(([difficulty, levels])=> [difficulty, levels.length])),
          size: levelPool.size,
        }
        : null,
    };
  }
}

module.exports= {AdminData, PERIODS};
