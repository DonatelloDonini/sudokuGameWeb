const path= require("node:path");
const express= require("express");
const {generateLevel, MIN_DIFFICULTY, MAX_DIFFICULTY, DEFAULT_DIFFICULTY}= require("./levelGenerator");

const DEFAULT_FRONTEND_DIR= path.resolve(__dirname, "../../frontend");

/**
 * Builds the express application: the level generation API plus the static frontend.
 * @param {Object} options
 * @param {string} options.frontendDir The folder containing the frontend's static files.
 * @returns {express.Express}
 */
const createApp= ({frontendDir= DEFAULT_FRONTEND_DIR}= {})=> {
  const app= express();
  app.disable("x-powered-by");

  app.get("/api/health", (req, res)=> {
    res.json({status: "ok"});
  });

  app.get("/api/level", (req, res)=> {
    const rawDifficulty= req.query.difficulty ?? String(DEFAULT_DIFFICULTY);
    const difficulty= Number(rawDifficulty);

    if (
      (! /^\d+$/.test(rawDifficulty)) ||
      (difficulty< MIN_DIFFICULTY) ||
      (difficulty> MAX_DIFFICULTY)
    ){
      return res.status(400).json({
        error: `difficulty must be an integer between ${MIN_DIFFICULTY} and ${MAX_DIFFICULTY}`,
      });
    }

    res.set("Cache-Control", "no-store");
    res.json(generateLevel(difficulty));
  });

  app.use("/api", (req, res)=> {
    res.status(404).json({error: "not found"});
  });

  app.use(express.static(frontendDir));

  app.use((err, req, res, next)=> {
    console.error(err);
    res.status(500).json({error: "internal server error"});
  });

  return app;
};

module.exports= {createApp};
