const http= require("node:http");
const {openDatabase}= require("../src/database");
const {createApp, createServices}= require("../src/app");
const {BattleManager}= require("../src/battle/BattleManager");
const {attachBattleServer}= require("../src/battle/websocket");

/**
 * Starts the whole server (API + battle websocket) on a random port with an in-memory database.
 */
const startServer= async (battleOptions= {})=> {
  const db= openDatabase(":memory:");
  const services= createServices(db);
  const server= http.createServer(createApp({services}));
  const battleManager= new BattleManager({db, users: services.users, countdownMs: 0, ...battleOptions});
  const wss= attachBattleServer(server, {sessions: services.sessions, battleManager});

  await new Promise(resolve=> server.listen(0, "127.0.0.1", resolve));
  const baseUrl= `http://127.0.0.1:${server.address().port}`;

  return {
    db,
    services,
    battleManager,
    baseUrl,
    close: async ()=> {
      battleManager.stop();
      for (const client of wss.clients) client.terminate();
      await new Promise(resolve=> server.close(resolve));
      db.close();
    },
  };
};

/**
 * A tiny HTTP client keeping the session cookie, like a browser would.
 */
const createClient= (baseUrl)=> {
  let cookie= null;

  const request= async (method, path, body)=> {
    const response= await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body!== undefined ? {"Content-Type": "application/json"} : {}),
        ...(cookie ? {Cookie: cookie} : {}),
      },
      body: body!== undefined ? JSON.stringify(body) : undefined,
    });

    const setCookie= response.headers.get("set-cookie");
    if (setCookie) cookie= setCookie.split(";")[0];

    const text= await response.text();
    return {status: response.status, body: text ? JSON.parse(text) : null};
  };

  return {
    get: (path)=> request("GET", path),
    post: (path, body= {})=> request("POST", path, body),
    get cookie(){
      return cookie;
    },
  };
};

/** A fixed, valid sudoku solution. */
const SOLUTION= [
  [5, 3, 4, 6, 7, 8, 9, 1, 2],
  [6, 7, 2, 1, 9, 5, 3, 4, 8],
  [1, 9, 8, 3, 4, 2, 5, 6, 7],
  [8, 5, 9, 7, 6, 1, 4, 2, 3],
  [4, 2, 6, 8, 5, 3, 7, 9, 1],
  [7, 1, 3, 9, 2, 4, 8, 5, 6],
  [9, 6, 1, 5, 3, 7, 2, 8, 4],
  [2, 8, 7, 4, 1, 9, 6, 3, 5],
  [3, 4, 5, 2, 8, 6, 1, 7, 9],
];

const copy= (board)=> board.map(row=> [...row]);

module.exports= {startServer, createClient, SOLUTION, copy};
