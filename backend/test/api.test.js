const {test, describe, before, after}= require("node:test");
const assert= require("node:assert/strict");
const {startServer, createClient, copy}= require("./helpers");

let server;

before(async ()=> {
  server= await startServer();
});

after(()=> server.close());

/** Reads the solution of a game straight from the database. */
const solutionOf= (gameId)=> JSON.parse(server.db.prepare("SELECT solution FROM games WHERE id = ?").get(gameId).solution);

describe("misc", ()=> {
  test("GET /api/health answers ok", async ()=> {
    const {status, body}= await createClient(server.baseUrl).get("/api/health");
    assert.equal(status, 200);
    assert.deepEqual(body, {status: "ok"});
  });

  test("unknown API routes return a JSON 404", async ()=> {
    const {status, body}= await createClient(server.baseUrl).get("/api/nope");
    assert.equal(status, 404);
    assert.deepEqual(body, {error: "not found"});
  });

  test("malformed JSON returns 400", async ()=> {
    const response= await fetch(`${server.baseUrl}/api/games`, {method: "POST", headers: {"Content-Type": "application/json"}, body: "{nope"});
    assert.equal(response.status, 400);
  });

  test("the old documentation address leads to the developers area", async ()=> {
    const response= await fetch(`${server.baseUrl}/api.html`, {redirect: "manual"});
    assert.equal(response.status, 301);
    assert.equal(response.headers.get("location"), "/developers/");
  });

  test("the landing page, the game and the developers area are served", async ()=> {
    for (const [path, title]of [["/play/", "Sudoku"], ["/developers/", "Sudoku for developers"]]){
      const response= await fetch(`${server.baseUrl}${path}`);
      assert.equal(response.status, 200, path);
      assert.match(await response.text(), new RegExp(`<title>${title}</title>`), path);
    }
  });

  test("the frontend is served from /", async ()=> {
    const response= await fetch(`${server.baseUrl}/`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /<title>Sudoku<\/title>/);
  });
});

describe("auth", ()=> {
  test("register, me, logout and login", async ()=> {
    const client= createClient(server.baseUrl);

    const registered= await client.post("/api/auth/register", {username: "Mario_1", password: "secret1"});
    assert.equal(registered.status, 201);
    assert.equal(registered.body.user.username, "Mario_1");
    assert.equal(registered.body.user.elo, 1200);
    assert.ok(client.cookie);

    assert.equal((await client.get("/api/auth/me")).body.user.username, "Mario_1");

    await client.post("/api/auth/logout");
    assert.equal((await client.get("/api/auth/me")).body.user, null);

    const loggedIn= await client.post("/api/auth/login", {username: "mario_1", password: "secret1"});
    assert.equal(loggedIn.status, 200, "usernames are case insensitive");
    assert.equal((await client.get("/api/auth/me")).body.user.username, "Mario_1");
  });

  test("the session cookie is httpOnly", async ()=> {
    const response= await fetch(`${server.baseUrl}/api/auth/register`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({username: "cookie_check", password: "secret1"}),
    });
    assert.match(response.headers.get("set-cookie"), /HttpOnly/i);
    assert.match(response.headers.get("set-cookie"), /SameSite=Lax/i);
  });

  test("passwords are not stored in clear", ()=> {
    const {password_hash}= server.db.prepare("SELECT password_hash FROM users WHERE username = 'Mario_1'").get();
    assert.ok(! password_hash.includes("secret1"));
  });

  test("wrong credentials and invalid registrations are rejected", async ()=> {
    const client= createClient(server.baseUrl);
    assert.equal((await client.post("/api/auth/login", {username: "Mario_1", password: "wrong!!"})).status, 401);
    assert.equal((await client.post("/api/auth/login", {username: "nobody", password: "secret1"})).status, 401);
    assert.equal((await client.post("/api/auth/register", {username: "MARIO_1", password: "secret1"})).status, 409);
    assert.equal((await client.post("/api/auth/register", {username: "a b", password: "secret1"})).status, 400);
    assert.equal((await client.post("/api/auth/register", {username: "shortpw", password: "123"})).status, 400);
    assert.equal((await client.post("/api/auth/register", {username: ["array"], password: "secret1"})).status, 400);
  });
});

describe("single player games", ()=> {
  test("a guest can play but isn't ranked, and the solution stays on the server", async ()=> {
    const guest= createClient(server.baseUrl);
    const {status, body}= await guest.post("/api/games", {difficulty: "easy"});

    assert.equal(status, 201);
    assert.equal(body.ranked, false);
    assert.equal(body.difficulty, "easy");
    assert.equal(body.puzzle.length, 9);
    assert.equal(body.solution, undefined);
  });

  test("invalid difficulties are rejected", async ()=> {
    assert.equal((await createClient(server.baseUrl).post("/api/games", {difficulty: "nightmare"})).status, 400);
  });

  test("hints fix mistakes first, then fill empty cells", async ()=> {
    const client= createClient(server.baseUrl);
    const {body: game}= await client.post("/api/games", {difficulty: "easy"});
    const solution= solutionOf(game.id);

    const board= copy(game.puzzle);
    const y= board.findIndex(row=> row.includes(null));
    const x= board[y].indexOf(null);
    board[y][x]= solution[y][x]=== 9 ? 1 : solution[y][x] + 1;

    const first= await client.post(`/api/games/${game.id}/hint`, {board});
    assert.deepEqual(first.body, {x, y, value: solution[y][x], hintsUsed: 1});

    board[y][x]= solution[y][x];
    const second= await client.post(`/api/games/${game.id}/hint`, {board});
    assert.equal(board[second.body.y][second.body.x], null);
    assert.equal(second.body.value, solution[second.body.y][second.body.x]);
    assert.equal(second.body.hintsUsed, 2);
  });

  test("boards that change the given numbers are rejected", async ()=> {
    const client= createClient(server.baseUrl);
    const {body: game}= await client.post("/api/games", {difficulty: "easy"});
    const board= copy(game.puzzle);
    const y= board.findIndex(row=> row.some(cell=> cell!== null));
    const x= board[y].findIndex(cell=> cell!== null);
    board[y][x]= null;

    assert.equal((await client.post(`/api/games/${game.id}/hint`, {board})).status, 400);
    assert.equal((await client.post(`/api/games/${game.id}/complete`, {board: "nope"})).status, 400);
  });

  test("completing a ranked game puts it on the leaderboard", async ()=> {
    const player= createClient(server.baseUrl);
    await player.post("/api/auth/register", {username: "speedy", password: "secret1"});

    const {body: game}= await player.post("/api/games", {difficulty: "hard"});
    assert.equal(game.ranked, true);

    const wrongBoard= solutionOf(game.id);
    const emptyCell= game.puzzle.flat().indexOf(null);
    const [y, x]= [Math.floor(emptyCell/9), emptyCell%9];
    wrongBoard[y][x]= null;
    assert.deepEqual((await player.post(`/api/games/${game.id}/complete`, {board: wrongBoard})).body, {solved: false});

    const result= await player.post(`/api/games/${game.id}/complete`, {board: solutionOf(game.id)});
    assert.equal(result.body.solved, true);
    assert.equal(result.body.ranked, true);
    assert.equal(result.body.rank, 1);
    assert.ok(result.body.durationMs>= 0);

    assert.equal((await player.post(`/api/games/${game.id}/complete`, {board: solutionOf(game.id)})).status, 409, "a game can be completed once");

    const {body: leaderboard}= await player.get("/api/leaderboard/times/hard");
    assert.equal(leaderboard.players[0].username, "speedy");
    assert.equal(leaderboard.players[0].completed, 1);

    assert.equal((await player.get("/api/auth/me")).body.user.gamesCompleted, 1);
  });

  test("showing the solution ends the game without ranking it", async ()=> {
    const player= createClient(server.baseUrl);
    await player.post("/api/auth/register", {username: "quitter", password: "secret1"});
    const {body: game}= await player.post("/api/games", {difficulty: "expert"});

    const {body}= await player.post(`/api/games/${game.id}/solution`);
    assert.deepEqual(body.solution, solutionOf(game.id));
    assert.equal((await player.post(`/api/games/${game.id}/complete`, {board: body.solution})).status, 409);

    const {body: leaderboard}= await player.get("/api/leaderboard/times/expert");
    assert.ok(! leaderboard.players.some(entry=> entry.username=== "quitter"));
  });

  test("a ranked game can only be played by its owner", async ()=> {
    const owner= createClient(server.baseUrl);
    await owner.post("/api/auth/register", {username: "owner", password: "secret1"});
    const {body: game}= await owner.post("/api/games", {difficulty: "easy"});

    const stranger= createClient(server.baseUrl);
    assert.equal((await stranger.post(`/api/games/${game.id}/solution`)).status, 403);
    assert.equal((await stranger.post("/api/games/not-a-game/solution")).status, 404);
  });

  test("the leaderboard rejects unknown difficulties", async ()=> {
    assert.equal((await createClient(server.baseUrl).get("/api/leaderboard/times/nightmare")).status, 400);
  });
});
