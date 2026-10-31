const {test, describe, before, after}= require("node:test");
const assert= require("node:assert/strict");
const fs= require("node:fs");
const os= require("node:os");
const path= require("node:path");
const {startServer, createClient, SOLUTION, copy}= require("./helpers");
const {analyzeMoves, MAX_REPORTS_PER_DAY}= require("../src/reports");
const {run: runCli}= require("../src/cli");
const {openDatabase}= require("../src/database");
const {Users}= require("../src/users");

/** Battles use the fixed solution with its first two rows emptied. */
const PUZZLE= SOLUTION.map((row, y)=> y< 2 ? new Array(9).fill(null) : [...row]);
const EMPTY_CELLS= PUZZLE.flatMap((row, y)=> row.map((cell, x)=> ({x, y, cell}))).filter(({cell})=> cell=== null);

let server;

before(async ()=> {
  server= await startServer({generate: (difficulty)=> ({difficulty, puzzle: copy(PUZZLE), solution: copy(SOLUTION), grade: {hardestTechnique: "Hidden single"}})});
});

after(()=> server.close());

const register= async (username)=> {
  const client= createClient(server.baseUrl);
  const {body}= await client.post("/api/auth/register", {username, password: "secret1"});
  return {client, user: body.user};
};

const makeAdmin= async (username)=> {
  const player= await register(username);
  server.services.users.setAdmin(player.user.id, true);
  return player;
};

const fakeConnection= ()=> ({
  messages: [],
  closed: false,
  send(message){
    this.messages.push(message);
  },
  close(){
    this.closed= true;
  },
});

/**
 * Plays a battle through the battle manager: `winner` fills the board, `loser` fills a few cells.
 * @returns {string} The id of the battle.
 */
const playBattle= (winner, loser, {winnerMistakes= 0}= {})=> {
  const manager= server.battleManager;
  const connections= [fakeConnection(), fakeConnection()];
  manager.connect(winner.user, connections[0]);
  manager.connect(loser.user, connections[1]);
  manager.handleMessage(winner.user.id, {type: "join-queue"});
  manager.handleMessage(loser.user.id, {type: "join-queue"});

  const battleId= connections[0].messages.find(message=> message.type=== "battle-start").battleId;
  for (const {x, y} of EMPTY_CELLS.slice(0, 5)) manager.handleMessage(loser.user.id, {type: "move", x, y, value: SOLUTION[y][x]});
  for (let i= 0; i<winnerMistakes; i++){
    const {x, y}= EMPTY_CELLS[i];
    manager.handleMessage(winner.user.id, {type: "move", x, y, value: SOLUTION[y][x]=== 9 ? 1 : SOLUTION[y][x] + 1});
  }
  for (const {x, y} of EMPTY_CELLS) manager.handleMessage(winner.user.id, {type: "move", x, y, value: SOLUTION[y][x]});

  manager.disconnect(winner.user.id, connections[0]);
  manager.disconnect(loser.user.id, connections[1]);
  return battleId;
};

describe("reports", ()=> {
  test("players can report a battle opponent", async ()=> {
    const cheater= await register("fast_fingers");
    const victim= await register("honest_player");
    const battleId= playBattle(cheater, victim);

    const {status, body}= await victim.client.post("/api/reports", {username: "fast_fingers", battleId, reason: "solver", comment: "Too fast"});
    assert.equal(status, 201);
    assert.ok(body.id);

    const duplicate= await victim.client.post("/api/reports", {username: "fast_fingers", battleId, reason: "solver"});
    assert.equal(duplicate.status, 409);
  });

  test("reports are validated", async ()=> {
    const reporter= await register("picky_reporter");
    await register("someone_else");

    assert.equal((await createClient(server.baseUrl).post("/api/reports", {username: "someone_else", reason: "solver"})).status, 401);
    assert.equal((await reporter.client.post("/api/reports", {username: "picky_reporter", reason: "solver"})).status, 400, "not yourself");
    assert.equal((await reporter.client.post("/api/reports", {username: "nobody_here", reason: "solver"})).status, 404);
    assert.equal((await reporter.client.post("/api/reports", {username: "someone_else", reason: "vibes"})).status, 400);
    assert.equal((await reporter.client.post("/api/reports", {username: "someone_else", reason: "other", comment: "x".repeat(501)})).status, 400);
    assert.equal((await reporter.client.post("/api/reports", {username: "someone_else", battleId: "not-their-battle", reason: "solver"})).status, 400);
    assert.equal((await reporter.client.post("/api/reports", {username: "someone_else", reason: "impossible_time"})).status, 201, "reports without a battle are fine");
  });

  test("the reasons are listed", async ()=> {
    const {body}= await createClient(server.baseUrl).get("/api/reports/reasons");
    assert.deepEqual(body.reasons.map(reason=> reason.id), ["solver", "impossible_time", "disconnect_abuse", "other"]);
  });

  test(`a player can send at most ${MAX_REPORTS_PER_DAY} reports a day`, async ()=> {
    const reporter= await register("angry_reporter");
    for (let i= 0; i<MAX_REPORTS_PER_DAY; i++){
      await register(`target_${i}`);
      assert.equal((await reporter.client.post("/api/reports", {username: `target_${i}`, reason: "other"})).status, 201);
    }
    await register("target_last");
    assert.equal((await reporter.client.post("/api/reports", {username: "target_last", reason: "other"})).status, 429);
  });
});

describe("admin API", ()=> {
  test("is only for admins", async ()=> {
    assert.equal((await createClient(server.baseUrl).get("/api/admin/stats")).status, 401);

    const player= await register("curious_player");
    assert.equal((await player.client.get("/api/admin/stats")).status, 403);
    assert.equal((await player.client.post(`/api/admin/users/${player.user.id}/admin`, {isAdmin: true})).status, 403);

    const admin= await makeAdmin("first_admin");
    assert.equal((await admin.client.get("/api/admin/stats")).status, 200);
    assert.equal((await admin.client.get("/api/auth/me")).body.user.isAdmin, true);
  });

  test("stats have totals and one entry per day of the period", async ()=> {
    const admin= await makeAdmin("stats_admin");
    await admin.client.post("/api/games", {difficulty: "easy"});

    const {body}= await admin.client.get("/api/admin/stats?period=week");
    assert.equal(body.daily.length, 7);
    assert.ok(body.totals.users>= 1);
    assert.ok(body.totals.gamesStarted>= 1);
    assert.ok(body.daily.at(-1).games>= 1, "today's game is counted");
    assert.ok(body.difficulties.some(row=> row.difficulty=== "easy"));

    assert.equal((await admin.client.get("/api/admin/stats?period=decade")).status, 400);
    assert.equal((await admin.client.get("/api/admin/stats?period=all")).status, 200);
  });

  test("lists and searches users, battles, games and the system state", async ()=> {
    const admin= await makeAdmin("list_admin");
    await register("needle_user");
    await register("other_100%");

    const {body}= await admin.client.get("/api/admin/users?search=needle");
    assert.deepEqual(body.users.map(user=> user.username), ["needle_user"]);
    assert.deepEqual((await admin.client.get("/api/admin/users?search=%25")).body.users.map(user=> user.username), [], "% is searched literally");

    assert.ok(Array.isArray((await admin.client.get("/api/admin/battles")).body.battles));
    assert.ok(Array.isArray((await admin.client.get("/api/admin/games")).body.games));

    const {body: system}= await admin.client.get("/api/admin/system");
    assert.ok(system.uptimeMs>= 0);
    assert.deepEqual(Object.keys(system.battles), ["connected", "queued", "battles"]);
  });

  test("admins can grant and remove admin rights, but not their own", async ()=> {
    const admin= await makeAdmin("granting_admin");
    const player= await register("future_admin");

    assert.equal((await admin.client.post(`/api/admin/users/${player.user.id}/admin`, {isAdmin: true})).status, 200);
    assert.equal((await player.client.get("/api/admin/stats")).status, 200);

    assert.equal((await admin.client.post(`/api/admin/users/${player.user.id}/admin`, {isAdmin: "yes"})).status, 400);
    assert.equal((await admin.client.post(`/api/admin/users/${admin.user.id}/admin`, {isAdmin: false})).status, 400);
    assert.equal((await admin.client.post("/api/admin/users/999999/admin", {isAdmin: true})).status, 404);
  });

  test("a banned user is logged out, can't log in and leaves the leaderboards", async ()=> {
    const admin= await makeAdmin("banning_admin");
    const player= await register("soon_banned");
    const {body: game}= await player.client.post("/api/games", {difficulty: "medium"});
    const solution= JSON.parse(server.db.prepare("SELECT solution FROM games WHERE id = ?").get(game.id).solution);
    await player.client.post(`/api/games/${game.id}/complete`, {board: solution});
    assert.ok((await player.client.get("/api/leaderboard/times/medium")).body.players.some(entry=> entry.username=== "soon_banned"));

    assert.equal((await admin.client.post(`/api/admin/users/${admin.user.id}/ban`, {})).status, 400, "not yourself");
    assert.equal((await admin.client.post(`/api/admin/users/${player.user.id}/ban`, {reason: "Solver"})).status, 200);

    assert.equal((await player.client.get("/api/auth/me")).body.user, null);
    const login= await createClient(server.baseUrl).post("/api/auth/login", {username: "soon_banned", password: "secret1"});
    assert.equal(login.status, 403);
    assert.match(login.body.error, /suspended: Solver/);
    assert.ok(! (await admin.client.get("/api/leaderboard/times/medium")).body.players.some(entry=> entry.username=== "soon_banned"));

    await admin.client.post(`/api/admin/users/${player.user.id}/unban`);
    assert.equal((await createClient(server.baseUrl).post("/api/auth/login", {username: "soon_banned", password: "secret1"})).status, 200);
  });

  test("a report shows the evidence, and banning closes all the open reports on the player", async ()=> {
    const admin= await makeAdmin("judge_admin");
    const cheater= await register("too_perfect");
    const victimA= await register("victim_a");
    const victimB= await register("victim_b");

    const battleId= playBattle(cheater, victimA);
    await victimA.client.post("/api/reports", {username: "too_perfect", battleId, reason: "solver"});
    await victimB.client.post("/api/reports", {username: "too_perfect", reason: "impossible_time"});

    const {body: list}= await admin.client.get("/api/admin/reports");
    const reportSummary= list.reports.find(report=> report.battleId=== battleId);
    assert.equal(reportSummary.reported, "too_perfect");
    assert.equal(reportSummary.openReportsOnReported, 2);

    const {body: report}= await admin.client.get(`/api/admin/reports/${reportSummary.id}`);
    assert.equal(report.reported.username, "too_perfect");
    assert.equal(report.reported.reports.open, 2);
    assert.equal(report.battle.winner, "too_perfect");
    const cheaterPlay= report.battle.players.find(player=> player.username=== "too_perfect");
    assert.equal(cheaterPlay.placements, EMPTY_CELLS.length);
    assert.equal(cheaterPlay.correctCells, EMPTY_CELLS.length);
    assert.equal(cheaterPlay.wrongPlacements, 0);
    assert.equal(cheaterPlay.timeline.at(-1).correct, EMPTY_CELLS.length);
    assert.ok(cheaterPlay.signals.includes("10 numbers placed in less than 6 seconds"));

    // the cheater is in the queue when banned: they are kicked out
    const connection= fakeConnection();
    server.battleManager.connect(cheater.user, connection);
    server.battleManager.handleMessage(cheater.user.id, {type: "join-queue"});

    assert.equal((await admin.client.post(`/api/admin/reports/${reportSummary.id}/resolve`, {action: "maybe"})).status, 400);
    assert.equal((await admin.client.post(`/api/admin/reports/${reportSummary.id}/resolve`, {action: "ban", note: "Bot"})).status, 200);
    assert.equal(connection.closed, true);
    assert.equal(server.battleManager.queue.has(cheater.user.id), false);

    const open= (await admin.client.get("/api/admin/reports")).body.reports.filter(entry=> entry.reported=== "too_perfect");
    assert.deepEqual(open, []);
    const closed= (await admin.client.get("/api/admin/reports?status=actioned")).body.reports.filter(entry=> entry.reported=== "too_perfect");
    assert.equal(closed.length, 2);
    assert.equal((await admin.client.post(`/api/admin/reports/${reportSummary.id}/resolve`, {action: "dismiss"})).status, 409);
  });

  test("dismissing a report leaves the player alone", async ()=> {
    const admin= await makeAdmin("fair_admin");
    const player= await register("just_good");
    const reporter= await register("sore_loser");
    await reporter.client.post("/api/reports", {username: "just_good", reason: "solver"});

    const report= (await admin.client.get("/api/admin/reports")).body.reports.find(entry=> entry.reported=== "just_good");
    await admin.client.post(`/api/admin/reports/${report.id}/resolve`, {action: "dismiss", note: "Normal play"});

    const {body}= await admin.client.get(`/api/admin/reports/${report.id}`);
    assert.equal(body.status, "dismissed");
    assert.equal(body.resolutionNote, "Normal play");
    assert.equal(body.resolvedBy, "fair_admin");
    assert.equal(body.reported.banned, false);
    assert.equal((await player.client.get("/api/auth/me")).body.user.username, "just_good");
  });
});

describe("analyzeMoves", ()=> {
  const solution= SOLUTION;
  const cells= EMPTY_CELLS;

  test("a human-like game raises no signal", ()=> {
    const moves= [];
    let time= 0;
    cells.forEach(({x, y}, i)=> {
      time+= 2000 + (i % 5) * 4000;
      if (i=== 3){
        moves.push({at_ms: time, x, y, value: solution[y][x]=== 9 ? 1 : solution[y][x] + 1});
        time+= 3000;
      }
      moves.push({at_ms: time, x, y, value: solution[y][x]});
    });

    const result= analyzeMoves(moves, solution);
    assert.equal(result.wrongPlacements, 1);
    assert.equal(result.correctCells, cells.length);
    assert.deepEqual(result.signals, []);
  });

  test("a fast, flawless and regular game raises the signals", ()=> {
    // the signals need enough numbers to mean something: a whole empty board
    const allCells= Array.from({length: 81}, (_, i)=> ({x: i % 9, y: Math.floor(i / 9)}));
    const moves= allCells.map(({x, y}, i)=> ({at_ms: (i + 1) * 500, x, y, value: solution[y][x]}));
    const result= analyzeMoves(moves, solution);
    assert.equal(result.medianIntervalMs, 500);
    assert.equal(result.fastestTenMs, 4500);
    assert.equal(result.signals.length, 4);
  });

  test("erasing a correct number lowers the count", ()=> {
    const [{x, y}]= cells;
    const result= analyzeMoves([
      {at_ms: 1000, x, y, value: solution[y][x]},
      {at_ms: 2000, x, y, value: null},
    ], solution);
    assert.equal(result.correctCells, 0);
    assert.equal(result.erasures, 1);
    assert.deepEqual(result.timeline.map(point=> point.correct), [0, 1, 0]);
  });
});

describe("command line", ()=> {
  test("makes and removes admins, and unbans", ()=> {
    const databasePath= path.join(fs.mkdtempSync(path.join(os.tmpdir(), "sudoku-cli-")), "test.db");
    const db= openDatabase(databasePath);
    const users= new Users(db);
    const user= users.create("cli_user", "x");
    users.ban(user.id, "test");
    db.close();

    assert.equal(runCli(["make-admin", "cli_user"], databasePath).code, 0);
    assert.equal(runCli(["unban", "CLI_USER"], databasePath).code, 0);
    assert.equal(runCli(["make-admin", "ghost"], databasePath).code, 1);
    assert.match(runCli([], databasePath).output, /Usage/);

    const check= openDatabase(databasePath);
    const updated= new Users(check).findById(user.id);
    assert.equal(updated.is_admin, 1);
    assert.equal(updated.banned_at, null);
    check.close();

    assert.equal(runCli(["remove-admin", "cli_user"], databasePath).code, 0);
  });
});
