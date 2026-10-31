const path= require("node:path");
const express= require("express");
const {Users}= require("./users");
const {Sessions}= require("./auth");
const {Games}= require("./games");
const {Reports}= require("./reports");
const {AdminData}= require("./admin");
const {authRouter}= require("./routes/auth");
const {gamesRouter}= require("./routes/games");
const {leaderboardRouter}= require("./routes/leaderboard");
const {publicApiRouter, publicApiCors, requestCost}= require("./routes/publicApi");
const {reportsRouter}= require("./routes/reports");
const {adminRouter}= require("./routes/admin");
const {generateLevel}= require("./levelGenerator");
const {rateLimit}= require("./rateLimit");

const DEFAULT_FRONTEND_DIR= path.resolve(__dirname, "../../frontend");

/**
 * Builds the data access objects shared by the HTTP routes and the battle server.
 * @param {import("node:sqlite").DatabaseSync} db
 * @param {Object} options
 * @param {boolean} [options.secureCookies]
 * @param {Function} [options.now]
 * @param {import("./levelPool").LevelPool} [options.levelPool] Where the levels come from (default: generated on demand).
 * @param {string} [options.databasePath] Shown in the admin dashboard.
 */
const createServices= (db, {secureCookies= false, now= Date.now, levelPool= null, databasePath= null}= {})=> {
  const users= new Users(db);
  const levels= levelPool
    ? {take: (difficulty)=> levelPool.take(difficulty), generate: (difficulty)=> levelPool.generate(difficulty)}
    : {take: generateLevel, generate: async (difficulty)=> generateLevel(difficulty)};

  return {
    db,
    users,
    levels,
    sessions: new Sessions(db, users, {secureCookies}),
    games: new Games(db, {now, generateLevel: levels.take}),
    reports: new Reports(db, users, {now}),
    adminData: new AdminData(db, users, {now, databasePath}),
  };
};

/**
 * Builds the express application: the API plus the static frontend.
 * @param {Object} options
 * @param {Object} options.services What createServices returns.
 * @param {string} [options.frontendDir] The folder containing the frontend's static files.
 * @param {number} [options.publicApiRateLimit] Requests (or generated puzzles) per minute and IP on the public API.
 * @param {string|number|boolean} [options.trustProxy] Express "trust proxy" setting, to get the client IP behind a reverse proxy.
 * @param {Object} [options.runtime] The battle manager and the level pool, for the admin dashboard.
 * @returns {express.Express}
 */
const createApp= ({services, frontendDir= DEFAULT_FRONTEND_DIR, publicApiRateLimit= 60, trustProxy= false, runtime= {}})=> {
  const app= express();
  app.disable("x-powered-by");
  app.set("trust proxy", trustProxy);

  // the public API for other developers: no cookies, any origin, rate limited
  app.use("/api/v1",
    publicApiCors,
    express.json({limit: "16kb"}),
    rateLimit({limit: publicApiRateLimit, cost: requestCost}),
    publicApiRouter(services),
  );

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
  app.use("/api/reports", reportsRouter(services));
  app.use("/api/admin", adminRouter(services, runtime));

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
