const express= require("express");
const {isValidDifficulty, techniquesByDifficulty, DIFFICULTIES, DEFAULT_DIFFICULTY}= require("../levelGenerator");
const {isValidBoard, respectsPuzzle}= require("../boards");
const {HINT_PENALTY_MS}= require("../games");

/**
 * /api/games: single player games.
 */
const gamesRouter= ({games})=> {
  const router= express.Router();

  router.get("/difficulties", (req, res)=> {
    res.json({
      difficulties: Object.keys(DIFFICULTIES),
      default: DEFAULT_DIFFICULTY,
      techniques: techniquesByDifficulty(),
      hintPenaltyMs: HINT_PENALTY_MS,
    });
  });

  router.post("/", (req, res)=> {
    const difficulty= req.body?.difficulty ?? DEFAULT_DIFFICULTY;
    if (! isValidDifficulty(difficulty)){
      return res.status(400).json({error: `difficulty must be one of: ${Object.keys(DIFFICULTIES).join(", ")}`});
    }

    const game= games.create(req.user?.id ?? null, difficulty);
    res.status(201).json({
      id: game.id,
      difficulty: game.difficulty,
      puzzle: game.puzzle,
      startedAt: game.started_at,
      ranked: game.user_id!== null,
    });
  });

  // loads the game and checks that it belongs to whoever is asking
  router.param("gameId", (req, res, next, gameId)=> {
    const game= games.find(gameId);
    if (! game) return res.status(404).json({error: "Game not found."});
    if (game.user_id!== null && game.user_id!== req.user?.id) return res.status(403).json({error: "This game belongs to another player."});

    req.game= game;
    next();
  });

  const requireInProgress= (req, res, next)=> {
    if (req.game.status!== "in_progress") return res.status(409).json({error: "This game is already over."});
    next();
  };

  const requireBoard= (req, res, next)=> {
    const board= req.body?.board;
    if (! isValidBoard(board) || ! respectsPuzzle(board, req.game.puzzle)){
      return res.status(400).json({error: "board must be a 9x9 grid of numbers 1-9 or null that keeps the given numbers."});
    }
    next();
  };

  router.post("/:gameId/hint", requireInProgress, requireBoard, (req, res)=> {
    const hint= games.hint(req.game, req.body.board);
    if (! hint) return res.status(409).json({error: "The board is already solved."});

    res.json({...hint, hintsUsed: req.game.hints_used + 1});
  });

  router.post("/:gameId/solution", requireInProgress, (req, res)=> {
    res.json({solution: games.reveal(req.game)});
  });

  router.post("/:gameId/complete", requireInProgress, requireBoard, (req, res)=> {
    const result= games.complete(req.game, req.body.board);
    if (! result.solved) return res.json(result);

    res.json({...result, ranked: req.game.user_id!== null, rank: games.rankOf(req.game, result.durationMs)});
  });

  return router;
};

module.exports= {gamesRouter};
