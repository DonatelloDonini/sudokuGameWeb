const http= require("node:http");
const path= require("node:path");
const {openDatabase}= require("./database");
const {createApp, createServices}= require("./app");
const {BattleManager}= require("./battle/BattleManager");
const {attachBattleServer}= require("./battle/websocket");
const {LevelPool}= require("./levelPool");

const PORT= Number(process.env.PORT) || 3000;
const HOST= process.env.HOST || "0.0.0.0";
const DATABASE_PATH= process.env.DATABASE_PATH || path.resolve(__dirname, "../data/sudoku.db");
const SECURE_COOKIES= process.env.COOKIE_SECURE=== "true";
const PUBLIC_API_RATE_LIMIT= Number(process.env.PUBLIC_API_RATE_LIMIT) || 60;

/**
 * TRUST_PROXY is passed to express' "trust proxy": "true", a number of hops, or IPs/subnets.
 */
const parseTrustProxy= (value)=> {
  if (value=== undefined || value=== "" || value=== "false") return false;
  if (value=== "true") return true;
  return /^\d+$/.test(value) ? Number(value) : value;
};

const levelPool= new LevelPool();
levelPool.start();

const db= openDatabase(DATABASE_PATH);
const services= createServices(db, {secureCookies: SECURE_COOKIES, levelPool});
services.sessions.deleteExpired();

const app= createApp({
  services,
  frontendDir: process.env.FRONTEND_DIR,
  publicApiRateLimit: PUBLIC_API_RATE_LIMIT,
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
});
const server= http.createServer(app);

const battleManager= new BattleManager({db, users: services.users, generate: services.levels.take});
battleManager.start();
const wss= attachBattleServer(server, {sessions: services.sessions, battleManager});

server.listen(PORT, HOST, ()=> {
  console.log(`Sudoku server listening on http://${HOST}:${PORT} (database: ${DATABASE_PATH})`);
});

// let `docker stop` shut the server down cleanly instead of waiting for the kill timeout
for (const signal of ["SIGINT", "SIGTERM"]){
  process.on(signal, ()=> {
    console.log(`Received ${signal}, shutting down`);
    battleManager.stop();
    levelPool.stop();
    for (const client of wss.clients) client.close(1001, "server shutting down");
    server.close(()=> {
      db.close();
      process.exit(0);
    });
    // don't wait forever for keep-alive connections
    setTimeout(()=> process.exit(0), 5000).unref();
  });
}
