const {transaction}= require("./database");

const REASONS= Object.freeze({
  solver: "Used a solver or a bot",
  impossible_time: "Impossible time",
  disconnect_abuse: "Leaves battles on purpose",
  other: "Other",
});

const MAX_COMMENT_LENGTH= 500;
const MAX_REPORTS_PER_DAY= 10;

/**
 * Thrown when a report can't be made; `status` is the HTTP status to answer with.
 */
class ReportError extends Error{
  constructor(status, message){
    super(message);
    this.name= "ReportError";
    this.status= status;
  }
}

const median= (values)=> {
  if (values.length=== 0) return null;
  const sorted= [...values].sort((a, b)=> a - b);
  const middle= Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/**
 * Sums up how a player played a battle, from their moves.
 *
 * @param {{at_ms: number, x: number, y: number, value: number|null}[]} moves In time order.
 * @param {number[][]} solution
 * @returns {Object} Counts, speed, the timeline of correct cells, and the signals worth a look.
 */
const analyzeMoves= (moves, solution)=> {
  const board= new Map();
  let correct= 0;
  const timeline= [{atMs: 0, correct: 0}];

  for (const move of moves){
    const cell= move.y*9 + move.x;
    if (board.get(cell)=== solution[move.y][move.x]) correct--;
    board.set(cell, move.value);
    if (move.value=== solution[move.y][move.x]) correct++;
    timeline.push({atMs: move.at_ms, correct});
  }

  const placements= moves.filter(move=> move.value!== null);
  const intervals= placements.slice(1).map((move, i)=> move.at_ms - placements[i].at_ms);

  // the shortest time taken to place 10 numbers in a row
  let fastestTenMs= null;
  for (let i= 9; i<placements.length; i++){
    const span= placements[i].at_ms - placements[i - 9].at_ms;
    if (fastestTenMs=== null || span< fastestTenMs) fastestTenMs= span;
  }

  const stats= {
    moves: moves.length,
    placements: placements.length,
    erasures: moves.length - placements.length,
    wrongPlacements: placements.filter(move=> move.value!== solution[move.y][move.x]).length,
    correctCells: correct,
    lastMoveMs: moves.at(-1)?.at_ms ?? null,
    medianIntervalMs: median(intervals),
    fastestTenMs,
    timeline,
  };

  // simple warning signs for the admins: people make mistakes and slow down on the hard cells
  const signals= [];
  if (stats.placements>= 30 && stats.wrongPlacements=== 0 && stats.erasures=== 0) signals.push("No mistake and no correction at all");
  if (stats.medianIntervalMs!== null && stats.placements>= 20 && stats.medianIntervalMs< 1500) signals.push("Less than 1.5 seconds per number");
  if (fastestTenMs!== null && fastestTenMs< 6000) signals.push("10 numbers placed in less than 6 seconds");
  if (intervals.length>= 20){
    const spread= Math.max(...intervals) / Math.max(1, Math.min(...intervals));
    if (spread< 4) signals.push("Very regular rhythm, even on the hard cells");
  }

  return {...stats, signals};
};

/**
 * Cheating reports: players report other players, admins look at the evidence and decide.
 */
class Reports{
  /**
   * @param {import("node:sqlite").DatabaseSync} db
   * @param {import("./users").Users} users
   * @param {Object} [options]
   * @param {Function} [options.now]
   */
  constructor(db, users, {now= Date.now}= {}){
    this.db= db;
    this.users= users;
    this.now= now;
  }

  /**
   * @param {Object} report
   * @param {Object} report.reporter The users row of who reports.
   * @param {string} report.username Who is reported.
   * @param {string} [report.battleId] The battle the report is about, if any (the reporter must have played it).
   * @param {string} report.reason One of the REASONS keys.
   * @param {string} [report.comment]
   * @returns {number} The id of the new report.
   * @throws {ReportError}
   */
  create({reporter, username, battleId= null, reason, comment= ""}){
    if (! Object.hasOwn(REASONS, reason)) throw new ReportError(400, `reason must be one of: ${Object.keys(REASONS).join(", ")}`);
    if (typeof comment!== "string" || comment.length> MAX_COMMENT_LENGTH) throw new ReportError(400, `The comment can't be longer than ${MAX_COMMENT_LENGTH} characters.`);
    if (battleId!== null && typeof battleId!== "string") throw new ReportError(400, "battleId must be a string.");

    const reported= typeof username=== "string" ? this.users.findByUsername(username) : null;
    if (! reported) throw new ReportError(404, "This player doesn't exist.");
    if (reported.id=== reporter.id) throw new ReportError(400, "You can't report yourself.");

    if (battleId!== null){
      const battle= this.db.prepare("SELECT player1_id, player2_id FROM battles WHERE id = ?").get(battleId);
      const players= battle ? [battle.player1_id, battle.player2_id] : [];
      if (! players.includes(reporter.id) || ! players.includes(reported.id)){
        throw new ReportError(400, "You can only report a battle you played against this player.");
      }
    }

    const duplicate= this.db.prepare(`
      SELECT 1 FROM reports
      WHERE reporter_id = ? AND reported_id = ? AND battle_id IS ? AND status = 'open'
    `).get(reporter.id, reported.id, battleId);
    if (duplicate) throw new ReportError(409, "You already reported this player for this, an admin will look at it.");

    const {today}= this.db
      .prepare("SELECT COUNT(*) AS today FROM reports WHERE reporter_id = ? AND created_at > ?")
      .get(reporter.id, this.now() - 24*60*60*1000);
    if (today>= MAX_REPORTS_PER_DAY) throw new ReportError(429, `You can send at most ${MAX_REPORTS_PER_DAY} reports a day.`);

    const {lastInsertRowid}= this.db.prepare(`
      INSERT INTO reports (reporter_id, reported_id, battle_id, reason, comment, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(reporter.id, reported.id, battleId, reason, comment.trim(), this.now());

    return Number(lastInsertRowid);
  }

  /**
   * @param {"open"|"dismissed"|"actioned"|"all"} [status]
   * @returns {Object[]} The reports, newest first, with the usernames and how many open reports each reported player has.
   */
  list(status= "open"){
    return this.db.prepare(`
      SELECT
        r.id, r.reason, r.comment, r.status, r.created_at AS createdAt, r.battle_id AS battleId,
        reporter.username AS reporter,
        reported.username AS reported,
        reported.banned_at IS NOT NULL AS reportedBanned,
        (SELECT COUNT(*) FROM reports other WHERE other.reported_id = r.reported_id AND other.status = 'open') AS openReportsOnReported
      FROM reports r
      JOIN users reporter ON reporter.id = r.reporter_id
      JOIN users reported ON reported.id = r.reported_id
      WHERE ? = 'all' OR r.status = ?
      ORDER BY r.created_at DESC
      LIMIT 500
    `).all(status, status).map(row=> ({...row, reportedBanned: row.reportedBanned=== 1, reasonLabel: REASONS[row.reason]}));
  }

  /**
   * A report with everything an admin needs to decide: the reported player's history and, for a battle,
   * how both players played it.
   * @returns {Object|null}
   */
  get(id){
    const report= this.db.prepare(`
      SELECT r.*, reporter.username AS reporter_username, resolver.username AS resolved_by_username
      FROM reports r
      JOIN users reporter ON reporter.id = r.reporter_id
      LEFT JOIN users resolver ON resolver.id = r.resolved_by
      WHERE r.id = ?
    `).get(id);
    if (! report) return null;

    const reported= this.users.findById(report.reported_id);
    return {
      id: report.id,
      reason: report.reason,
      reasonLabel: REASONS[report.reason],
      comment: report.comment,
      status: report.status,
      createdAt: report.created_at,
      resolvedAt: report.resolved_at,
      resolvedBy: report.resolved_by_username,
      resolutionNote: report.resolution_note,
      reporter: report.reporter_username,
      reported: this._playerHistory(reported),
      battle: report.battle_id ? this._battleEvidence(report.battle_id) : null,
    };
  }

  /**
   * Closes a report: "dismiss" when nothing is wrong, "ban" to ban the reported player
   * (which closes all their open reports).
   * @throws {ReportError}
   */
  resolve(id, admin, action, note= ""){
    const report= this.db.prepare("SELECT * FROM reports WHERE id = ?").get(id);
    if (! report) throw new ReportError(404, "Report not found.");
    if (report.status!== "open") throw new ReportError(409, "This report is already closed.");
    if (! ["dismiss", "ban"].includes(action)) throw new ReportError(400, "action must be dismiss or ban.");
    if (typeof note!== "string" || note.length> MAX_COMMENT_LENGTH) throw new ReportError(400, `The note can't be longer than ${MAX_COMMENT_LENGTH} characters.`);

    const close= (status, where, ...params)=> this.db.prepare(`
      UPDATE reports SET status = ?, resolved_at = ?, resolved_by = ?, resolution_note = ?
      WHERE ${where}
    `).run(status, this.now(), admin.id, note.trim(), ...params);

    transaction(this.db, ()=> {
      if (action=== "dismiss"){
        close("dismissed", "id = ?", id);
      }
      else{
        this.users.ban(report.reported_id, note.trim() || REASONS[report.reason]);
        close("actioned", "reported_id = ? AND status = 'open'", report.reported_id);
      }
    });

    return report.reported_id;
  }

  _playerHistory(user){
    const reports= this.db.prepare(`
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(status = 'open'), 0) AS open,
        COALESCE(SUM(status = 'actioned'), 0) AS actioned
      FROM reports WHERE reported_id = ?
    `).get(user.id);

    // their best solo times next to the typical time of everybody, per difficulty
    const soloTimes= this.db.prepare(`
      SELECT
        g.difficulty,
        MIN(g.duration_ms) AS bestMs,
        COUNT(*) AS completed,
        (SELECT AVG(duration_ms) FROM games WHERE status = 'completed' AND difficulty = g.difficulty) AS everybodyAverageMs
      FROM games g
      WHERE g.user_id = ? AND g.status = 'completed'
      GROUP BY g.difficulty
    `).all(user.id);

    return {
      ...this.users.toPublic(user),
      createdAt: user.created_at,
      banned: user.banned_at!== null,
      banReason: user.ban_reason,
      reports,
      soloTimes,
    };
  }

  _battleEvidence(battleId){
    const battle= this.db.prepare(`
      SELECT b.*, p1.username AS player1, p2.username AS player2, w.username AS winner
      FROM battles b
      JOIN users p1 ON p1.id = b.player1_id
      JOIN users p2 ON p2.id = b.player2_id
      JOIN users w ON w.id = b.winner_id
      WHERE b.id = ?
    `).get(battleId);
    if (! battle) return null;

    const solution= JSON.parse(battle.solution);
    const movesOf= this.db.prepare("SELECT at_ms, x, y, value FROM battle_moves WHERE battle_id = ? AND user_id = ? ORDER BY at_ms, rowid");

    return {
      id: battle.id,
      difficulty: battle.difficulty,
      hardestTechnique: battle.hardest_technique,
      emptyCells: JSON.parse(battle.puzzle).flat().filter(cell=> cell=== null).length,
      winner: battle.winner,
      endReason: battle.end_reason,
      eloChange: battle.elo_change,
      durationMs: battle.finished_at - battle.started_at,
      startedAt: battle.started_at,
      players: [
        {username: battle.player1, eloBefore: battle.player1_elo_before, ...analyzeMoves(movesOf.all(battle.id, battle.player1_id), solution)},
        {username: battle.player2, eloBefore: battle.player2_elo_before, ...analyzeMoves(movesOf.all(battle.id, battle.player2_id), solution)},
      ],
    };
  }
}

module.exports= {Reports, ReportError, REASONS, analyzeMoves, MAX_REPORTS_PER_DAY};
