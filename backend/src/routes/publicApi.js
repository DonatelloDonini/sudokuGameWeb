const express= require("express");
const {isValidDifficulty, techniquesByDifficulty, DIFFICULTIES, DEFAULT_DIFFICULTY}= require("../levelGenerator");
const {LevelQueueFullError}= require("../levelPool");
const {solveLogically, nextPlacement}= require("../sudoku/HumanSolver");
const {solve}= require("../sudoku/SudokuSolver");
const {FORMATS, PuzzleFormatError, parsePuzzle, formatPuzzle, breaksRules}= require("../puzzleFormat");

/** How many puzzles a single request can ask for. */
const MAX_PUZZLES_PER_REQUEST= 10;

const DIFFICULTY_BY_TIER= Object.fromEntries(Object.entries(DIFFICULTIES).map(([difficulty, {tier}])=> [tier, difficulty]));

const countEmpty= (board)=> board.flat().filter(cell=> cell=== null).length;

/**
 * @returns {number} How many units a public API request costs for the rate limit: one per generated puzzle, one otherwise.
 */
const requestCost= (req)=> {
  if (req.method!== "GET" || req.path!== "/puzzles") return 1;
  const count= Number(req.query.count ?? 1);
  return Number.isInteger(count) && count>= 1 && count<= MAX_PUZZLES_PER_REQUEST ? count : 1;
};

/**
 * Reads the format query parameter.
 * @returns {string|null} The format, or null after answering 400.
 */
const readFormat= (req, res)=> {
  const format= req.query.format ?? "array";
  if (! FORMATS.includes(format)){
    res.status(400).json({error: `format must be one of: ${FORMATS.join(", ")}`});
    return null;
  }
  return format;
};

/**
 * Reads the puzzle of the request body, answering 400/422 when it can't be used.
 * @returns {(number|null)[][]|null}
 */
const readPuzzle= (req, res)=> {
  try {
    const puzzle= parsePuzzle(req.body?.puzzle);
    if (breaksRules(puzzle)){
      res.status(422).json({error: "The puzzle breaks the rules: a number is repeated in a row, column or box."});
      return null;
    }
    return puzzle;
  }
  catch (error) {
    if (! (error instanceof PuzzleFormatError)) throw error;
    res.status(400).json({error: error.message});
    return null;
  }
};

/**
 * /api/v1: the public API, for developers who want sudoku levels without writing a generator.
 * It is stateless, needs no account and answers any origin (CORS); requests are rate limited per IP.
 *
 * @param {Object} services
 * @param {{generate: Function}} services.levels
 */
const publicApiRouter= ({levels})=> {
  const router= express.Router();

  router.get("/", (req, res)=> {
    res.json({
      name: "Sudoku API",
      version: 1,
      documentation: "/api.html",
      endpoints: {
        "GET /api/v1/difficulties": "the difficulties and the techniques each one needs",
        "GET /api/v1/puzzles?difficulty=medium&count=1&format=array": `new graded puzzles with their solution (up to ${MAX_PUZZLES_PER_REQUEST})`,
        "POST /api/v1/solve": "{puzzle}: the solution and whether it is unique",
        "POST /api/v1/grade": "{puzzle}: the difficulty of any puzzle and the techniques it needs",
        "POST /api/v1/hint": "{puzzle}: the next number a person could place, with the reasoning",
      },
    });
  });

  router.get("/difficulties", (req, res)=> {
    const techniques= techniquesByDifficulty();
    res.json({
      default: DEFAULT_DIFFICULTY,
      difficulties: Object.entries(DIFFICULTIES).map(([name, {tier, maxEmptyCells}])=> ({
        name,
        tier,
        techniques: techniques[name],
        maxEmptyCells,
      })),
    });
  });

  router.get("/puzzles", async (req, res)=> {
    const difficulty= req.query.difficulty ?? DEFAULT_DIFFICULTY;
    if (! isValidDifficulty(difficulty)){
      return res.status(400).json({error: `difficulty must be one of: ${Object.keys(DIFFICULTIES).join(", ")}`});
    }

    const count= Number(req.query.count ?? 1);
    if (! Number.isInteger(count) || count< 1 || count> MAX_PUZZLES_PER_REQUEST){
      return res.status(400).json({error: `count must be an integer between 1 and ${MAX_PUZZLES_PER_REQUEST}`});
    }

    const format= readFormat(req, res);
    if (! format) return;

    let generated;
    try {
      generated= await Promise.all(Array.from({length: count}, ()=> levels.generate(difficulty)));
    }
    catch (error) {
      if (! (error instanceof LevelQueueFullError)) throw error;
      res.set("Retry-After", "5");
      return res.status(503).json({error: error.message});
    }

    res.json({
      puzzles: generated.map(({puzzle, solution, grade})=> ({
        difficulty,
        puzzle: formatPuzzle(puzzle, format),
        solution: formatPuzzle(solution, format),
        emptyCells: countEmpty(puzzle),
        hardestTechnique: grade.hardestTechnique,
        score: grade.score,
        techniques: grade.techniques,
      })),
    });
  });

  router.post("/solve", (req, res)=> {
    const format= readFormat(req, res);
    if (! format) return;
    const puzzle= readPuzzle(req, res);
    if (! puzzle) return;

    const {solutions, solution}= solve(puzzle);
    res.json({
      solvable: solutions> 0,
      unique: solutions=== 1,
      solution: solution ? formatPuzzle(solution, format) : null,
    });
  });

  router.post("/grade", (req, res)=> {
    const puzzle= readPuzzle(req, res);
    if (! puzzle) return;

    const {solutions}= solve(puzzle);
    const logical= solutions=== 1 ? solveLogically(puzzle) : null;

    res.json({
      solvable: solutions> 0,
      unique: solutions=== 1,
      solvableWithLogic: logical?.solved ?? false,
      // null when the puzzle has no single solution or needs more than the expert techniques (guessing)
      difficulty: logical?.solved ? (DIFFICULTY_BY_TIER[logical.tier] ?? DIFFICULTY_BY_TIER[1]) : null,
      hardestTechnique: logical?.solved ? logical.hardestTechnique : null,
      score: logical?.solved ? logical.score : null,
      techniques: logical?.solved ? logical.techniques : null,
      emptyCells: countEmpty(puzzle),
    });
  });

  router.post("/hint", (req, res)=> {
    const puzzle= readPuzzle(req, res);
    if (! puzzle) return;

    const {solutions, solution}= solve(puzzle);
    if (solutions=== 0) return res.status(422).json({error: "The board has no solution: some numbers are wrong."});
    if (countEmpty(puzzle)=== 0) return res.status(409).json({error: "The board is already full."});

    const placement= solutions=== 1 ? nextPlacement(puzzle) : null;
    if (placement) return res.json(placement);

    // logic is stuck: the puzzle needs harder techniques than the solver knows, or has several solutions
    const emptyCells= [];
    puzzle.forEach((row, y)=> row.forEach((cell, x)=> {
      if (cell=== null) emptyCells.push({x, y});
    }));
    const {x, y}= emptyCells[Math.floor(Math.random()*emptyCells.length)];
    res.json({x, y, value: solution[y][x], technique: null, steps: []});
  });

  return router;
};

/**
 * CORS for the public API: any website can call it (it uses no cookies).
 */
const publicApiCors= (req, res, next)=> {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  res.set("Access-Control-Expose-Headers", "RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset, Retry-After");
  res.set("Access-Control-Max-Age", "86400");

  if (req.method=== "OPTIONS") return res.sendStatus(204);
  next();
};

module.exports= {publicApiRouter, publicApiCors, requestCost, MAX_PUZZLES_PER_REQUEST};
