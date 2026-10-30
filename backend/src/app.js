const path= require("node:path");
const express= require("express");
const {Users}= require("./users");
const {Sessions}= require("./auth");
const {Games}= require("./games");
const {authRouter}= require("./routes/auth");
const {gamesRouter}= require("./routes/games");
const {leaderboardRouter}= require("./routes/leaderboard");

const DEFAULT_FRONTEND_DIR= path.resolve(__dirname, "../../frontend");

/**
 * Builds the data access objects shared by the HTTP routes and the battle server.
 * @param {import("node:sqlite").DatabaseSync} db
 * @param {Object} options
 * @param {boolean} [options.secureCookies]
 * @param {Function} [options.now]
 */
const createServices= (db, {secureCookies= false, now= Date.now}= {})=> {
  const users= new Users(db);
  return {
    db,
    users,
    sessions: new Sessions(db, users, {secureCookies}),
    games: new Games(db, {now}),
  };
};

/**
 * Builds the express application: the API plus the static frontend.
 * @param {Object} options
 * @param {Object} options.services What createServices returns.
 * @param {string} [options.frontendDir] The folder containing the frontend's static files.
 * @returns {express.Express}
 */
const createApp= ({services, frontendDir= DEFAULT_FRONTEND_DIR})=> {
  const app= express();
  app.disable("x-powered-by");

  app.use("/api", express.json({limit: "16kb"}));
  app.use("/api", services.sessions.middleware());
  app.use("/api", (req, res, next)=> {
    res.set("Cache-Control", "no-store");
    next();
  });

  app.get("/api/health", (req, res)=> {
    res.json({status: "ok"});
  });

  app.use("/api/auth", authRouter(services));
  app.use("/api/games", gamesRouter(services));
  app.use("/api/leaderboard", leaderboardRouter(services));

  app.use("/api", (req, res)=> {
    res.status(404).json({error: "not found"});
  });

  app.use(express.static(frontendDir));

  app.use((err, req, res, next)=> {
    // malformed JSON bodies
    if (err.type=== "entity.parse.failed") return res.status(400).json({error: "invalid JSON"});
    if (err.type=== "entity.too.large") return res.status(413).json({error: "request too large"});

    console.error(err);
    res.status(500).json({error: "internal server error"});
  });

  return app;
};

module.exports= {createApp, createServices};
