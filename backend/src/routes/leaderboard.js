const express= require("express");
const {isValidDifficulty, DIFFICULTIES}= require("../levelGenerator");
const {eloLeaderboard, timesLeaderboard}= require("../leaderboard");

/**
 * /api/leaderboard: battle elo ranking and best single player times.
 */
const leaderboardRouter= ({db})=> {
  const router= express.Router();

  router.get("/elo", (req, res)=> {
    res.json({players: eloLeaderboard(db)});
  });

  router.get("/times/:difficulty", (req, res)=> {
    const {difficulty}= req.params;
    if (! isValidDifficulty(difficulty)){
      return res.status(400).json({error: `difficulty must be one of: ${Object.keys(DIFFICULTIES).join(", ")}`});
    }

    res.json({difficulty, players: timesLeaderboard(db, difficulty)});
  });

  return router;
};

module.exports= {leaderboardRouter};
