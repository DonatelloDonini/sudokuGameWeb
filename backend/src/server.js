const http= require("node:http");
const path= require("node:path");
const {openDatabase}= require("./database");
const {createApp, createServices}= require("./app");
const {BattleManager}= require("./battle/BattleManager");
const {attachBattleServer}= require("./battle/websocket");

const PORT= Number(process.env.PORT) || 3000;
const HOST= process.env.HOST || "0.0.0.0";
const DATABASE_PATH= process.env.DATABASE_PATH || path.resolve(__dirname, "../data/sudoku.db");
const SECURE_COOKIES= process.env.COOKIE_SECURE=== "true";

const db= openDatabase(DATABASE_PATH);
const services= createServices(db, {secureCookies: SECURE_COOKIES});
services.sessions.deleteExpired();

const app= createApp({services, frontendDir: process.env.FRONTEND_DIR});
const server= http.createServer(app);

const battleManager= new BattleManager({db, users: services.users});
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
    for (const client of wss.clients) client.close(1001, "server shutting down");
    server.close(()=> {
      db.close();
      process.exit(0);
    });
    // don't wait forever for keep-alive connections
    setTimeout(()=> process.exit(0), 5000).unref();
  });
}
