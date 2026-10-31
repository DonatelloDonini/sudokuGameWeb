const express= require("express");
const {ReportError, REASONS}= require("../reports");

/**
 * /api/reports: players report the players they think are cheating.
 */
const reportsRouter= ({reports})=> {
  const router= express.Router();

  router.get("/reasons", (req, res)=> {
    res.json({reasons: Object.entries(REASONS).map(([id, label])=> ({id, label}))});
  });

  router.post("/", (req, res)=> {
    if (! req.user) return res.status(401).json({error: "Log in to report a player."});

    const {username, battleId, reason, comment}= req.body ?? {};
    try {
      const id= reports.create({reporter: req.user, username, battleId: battleId ?? null, reason, comment: comment ?? ""});
      res.status(201).json({id});
    }
    catch (error) {
      if (! (error instanceof ReportError)) throw error;
      res.status(error.status).json({error: error.message});
    }
  });

  return router;
};

module.exports= {reportsRouter};
