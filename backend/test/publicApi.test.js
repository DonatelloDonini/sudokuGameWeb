const {test, describe, before, after}= require("node:test");
const assert= require("node:assert/strict");
const {startServer}= require("./helpers");
const {generateLevel, techniquesByDifficulty}= require("../src/levelGenerator");
const {hasUniqueSolution}= require("../src/sudoku/SudokuSolver");

let server;

before(async ()=> {
  server= await startServer();
});

after(()=> server.close());

const get= async (path, headers= {})=> {
  const response= await fetch(`${server.baseUrl}${path}`, {headers});
  return {status: response.status, headers: response.headers, body: await response.json()};
};

const post= async (path, body)=> {
  const response= await fetch(`${server.baseUrl}${path}`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(body),
  });
  return {status: response.status, body: await response.json()};
};

const EMPTY= Array.from({length: 9}, ()=> new Array(9).fill(null));

describe("public API basics", ()=> {
  test("the index lists the endpoints", async ()=> {
    const {status, body}= await get("/api/v1");
    assert.equal(status, 200);
    assert.equal(body.version, 1);
    assert.ok(Object.keys(body.endpoints).length>= 5);
  });

  test("any website can call it", async ()=> {
    const {headers}= await get("/api/v1/difficulties", {Origin: "https://another-game.example"});
    assert.equal(headers.get("access-control-allow-origin"), "*");

    const preflight= await fetch(`${server.baseUrl}/api/v1/solve`, {
      method: "OPTIONS",
      headers: {"Origin": "https://another-game.example", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"},
    });
    assert.equal(preflight.status, 204);
    assert.match(preflight.headers.get("access-control-allow-headers"), /Content-Type/);
  });

  test("the game's own API doesn't allow other origins", async ()=> {
    const response= await fetch(`${server.baseUrl}/api/auth/me`, {headers: {Origin: "https://another-game.example"}});
    assert.equal(response.headers.get("access-control-allow-origin"), null);
  });

  test("difficulties come with their techniques", async ()=> {
    const {body}= await get("/api/v1/difficulties");
    assert.deepEqual(body.difficulties.map(difficulty=> difficulty.name), ["easy", "medium", "hard", "expert"]);
    assert.deepEqual(body.difficulties.find(difficulty=> difficulty.name=== "hard").techniques, techniquesByDifficulty().hard);
  });
});

describe("GET /api/v1/puzzles", ()=> {
  test("returns graded puzzles with their solution", async ()=> {
    const {status, body}= await get("/api/v1/puzzles?difficulty=hard&count=2");
    assert.equal(status, 200);
    assert.equal(body.puzzles.length, 2);

    for (const level of body.puzzles){
      assert.equal(level.difficulty, "hard");
      assert.ok(techniquesByDifficulty().hard.includes(level.hardestTechnique));
      assert.equal(hasUniqueSolution(level.puzzle), true);
      assert.equal(level.emptyCells, level.puzzle.flat().filter(cell=> cell=== null).length);
      level.puzzle.forEach((row, y)=> row.forEach((cell, x)=> {
        if (cell!== null) assert.equal(cell, level.solution[y][x]);
      }));
    }
  });

  test("can return puzzles as 81 character strings", async ()=> {
    const {body}= await get("/api/v1/puzzles?difficulty=easy&format=string");
    const [{puzzle, solution}]= body.puzzles;
    assert.match(puzzle, /^[1-9.]{81}$/);
    assert.match(solution, /^[1-9]{81}$/);
  });

  test("rejects invalid parameters", async ()=> {
    assert.equal((await get("/api/v1/puzzles?difficulty=nightmare")).status, 400);
    assert.equal((await get("/api/v1/puzzles?count=11")).status, 400);
    assert.equal((await get("/api/v1/puzzles?count=0")).status, 400);
    assert.equal((await get("/api/v1/puzzles?count=two")).status, 400);
    assert.equal((await get("/api/v1/puzzles?format=xml")).status, 400);
  });
});

describe("POST /api/v1/solve", ()=> {
  test("solves puzzles sent as arrays (null or 0 for empty cells) or strings", async ()=> {
    const {puzzle, solution}= generateLevel("medium");

    const withZeros= puzzle.map(row=> row.map(cell=> cell ?? 0));
    const fromArray= await post("/api/v1/solve", {puzzle: withZeros});
    assert.deepEqual(fromArray.body, {solvable: true, unique: true, solution});

    const asString= puzzle.flat().map(cell=> cell ?? ".").join("");
    const fromString= await post("/api/v1/solve?format=string", {puzzle: asString});
    assert.equal(fromString.body.solution, solution.flat().join(""));
  });

  test("tells when a puzzle has several solutions", async ()=> {
    const {body}= await post("/api/v1/solve", {puzzle: EMPTY});
    assert.equal(body.solvable, true);
    assert.equal(body.unique, false);
    assert.equal(body.solution.length, 9);
  });

  test("rejects malformed puzzles and puzzles breaking the rules", async ()=> {
    assert.equal((await post("/api/v1/solve", {puzzle: "123"})).status, 400);
    assert.equal((await post("/api/v1/solve", {puzzle: [[1, 2, 3]]})).status, 400);
    assert.equal((await post("/api/v1/solve", {})).status, 400);

    const broken= EMPTY.map(row=> [...row]);
    broken[0][0]= 5;
    broken[0][8]= 5;
    assert.equal((await post("/api/v1/solve", {puzzle: broken})).status, 422);
  });
});

describe("POST /api/v1/grade", ()=> {
  test("grades any puzzle by the techniques it needs", async ()=> {
    const {puzzle, grade}= generateLevel("expert");
    const {body}= await post("/api/v1/grade", {puzzle});

    assert.equal(body.unique, true);
    assert.equal(body.solvableWithLogic, true);
    assert.equal(body.difficulty, "expert");
    assert.equal(body.hardestTechnique, grade.hardestTechnique);
    assert.ok(body.techniques["Hidden single"]> 0);
  });

  test("puzzles without a single solution have no difficulty", async ()=> {
    const {body}= await post("/api/v1/grade", {puzzle: EMPTY});
    assert.equal(body.unique, false);
    assert.equal(body.difficulty, null);
  });
});

describe("POST /api/v1/hint", ()=> {
  test("gives the next number with the reasoning, until the puzzle is solved", async ()=> {
    const {puzzle, solution}= generateLevel("hard");
    const board= puzzle.map(row=> [...row]);
    let sawReasoning= false;

    for (let requests= 0; board.flat().includes(null); requests++){
      assert.ok(requests< 81, "too many hints");
      const {status, body}= await post("/api/v1/hint", {puzzle: board});
      assert.equal(status, 200);
      assert.equal(body.value, solution[body.y][body.x]);
      assert.equal(board[body.y][body.x], null);
      if (body.steps.length> 0) sawReasoning= true;
      board[body.y][body.x]= body.value;
    }

    assert.deepEqual(board, solution);
    assert.ok(sawReasoning, "a hard puzzle needs eliminations before some placements");
  });

  test("refuses full boards and boards with mistakes", async ()=> {
    const {puzzle, solution}= generateLevel("easy");
    assert.equal((await post("/api/v1/hint", {puzzle: solution})).status, 409);

    // a wrong number that doesn't directly break a rule
    const wrong= puzzle.map(row=> [...row]);
    const y= wrong.findIndex(row=> row.includes(null));
    const x= wrong[y].indexOf(null);
    const candidates= [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(digit=> digit!== solution[y][x] && ! wrong[y].includes(digit) && ! wrong.some(row=> row[x]=== digit));
    const box= [];
    for (let dy= 0; dy<3; dy++) for (let dx= 0; dx<3; dx++) box.push(wrong[y - y%3 + dy][x - x%3 + dx]);
    const digit= candidates.find(candidate=> ! box.includes(candidate));
    if (digit=== undefined) return;

    wrong[y][x]= digit;
    assert.equal((await post("/api/v1/hint", {puzzle: wrong})).status, 422);
  });
});

describe("rate limiting", ()=> {
  test("each IP has a budget per minute, generated puzzles count one each", async ()=> {
    const limited= await startServer({}, {publicApiRateLimit: 4});
    try {
      const first= await fetch(`${limited.baseUrl}/api/v1/puzzles?difficulty=easy&count=3`);
      assert.equal(first.status, 200);
      assert.equal(first.headers.get("ratelimit-remaining"), "1");

      assert.equal((await fetch(`${limited.baseUrl}/api/v1/difficulties`)).status, 200);

      const blocked= await fetch(`${limited.baseUrl}/api/v1/difficulties`);
      assert.equal(blocked.status, 429);
      assert.ok(Number(blocked.headers.get("retry-after"))> 0);
      assert.match((await blocked.json()).error, /Rate limit/);

      // the game itself is not limited
      assert.equal((await fetch(`${limited.baseUrl}/api/health`)).status, 200);
    }
    finally {
      await limited.close();
    }
  });
});
