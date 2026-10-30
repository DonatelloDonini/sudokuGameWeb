const {test, before, after}= require("node:test");
const assert= require("node:assert/strict");
const {createApp}= require("../src/app");

let server;
let baseUrl;

before(async ()=> {
  server= createApp().listen(0);
  await new Promise(resolve=> server.once("listening", resolve));
  baseUrl= `http://127.0.0.1:${server.address().port}`;
});

after(()=> server.close());

test("GET /api/health answers ok", async ()=> {
  const response= await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {status: "ok"});
});

test("GET /api/level returns a 9x9 puzzle and solution", async ()=> {
  const response= await fetch(`${baseUrl}/api/level?difficulty=4`);
  assert.equal(response.status, 200);

  const level= await response.json();
  assert.equal(level.difficulty, 4);
  assert.equal(level.puzzle.length, 9);
  assert.equal(level.solution.length, 9);
  level.puzzle.forEach(row=> assert.equal(row.length, 9));
  level.solution.forEach(row=> assert.equal(row.length, 9));
});

test("GET /api/level uses the default difficulty when none is given", async ()=> {
  const response= await fetch(`${baseUrl}/api/level`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).difficulty, 6);
});

test("GET /api/level rejects invalid difficulties", async ()=> {
  for (const difficulty of ["-1", "10", "abc", "2.5", ""]){
    const response= await fetch(`${baseUrl}/api/level?difficulty=${difficulty}`);
    assert.equal(response.status, 400, `difficulty "${difficulty}" should be rejected`);
  }
});

test("unknown API routes return a JSON 404", async ()=> {
  const response= await fetch(`${baseUrl}/api/nope`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {error: "not found"});
});

test("the frontend is served from /", async ()=> {
  const response= await fetch(`${baseUrl}/`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /<title>Sudoku<\/title>/);
});
