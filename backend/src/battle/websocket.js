const {WebSocketServer}= require("ws");

const HEARTBEAT_INTERVAL_MS= 30 * 1000;

/**
 * Rejects cross-site websocket connections: the session cookie would be sent along with them.
 * @param {import("node:http").IncomingMessage} req
 * @returns {boolean}
 */
const isSameOrigin= (req)=> {
  const origin= req.headers.origin;
  if (! origin) return true;

  try {
    return new URL(origin).host=== req.headers.host;
  }
  catch {
    return false;
  }
};

const rejectUpgrade= (socket, status, message)=> {
  socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
};

/**
 * Accepts the battle websocket connections on `path` for logged in users and forwards their messages to the battle manager.
 * @param {import("node:http").Server} httpServer
 * @param {Object} options
 * @param {import("../auth").Sessions} options.sessions
 * @param {import("./BattleManager").BattleManager} options.battleManager
 * @param {string} [options.path]
 * @returns {WebSocketServer}
 */
const attachBattleServer= (httpServer, {sessions, battleManager, path= "/ws"})=> {
  const wss= new WebSocketServer({noServer: true, maxPayload: 4 * 1024});

  httpServer.on("upgrade", (req, socket, head)=> {
    const {pathname}= new URL(req.url, "http://localhost");
    if (pathname!== path) return rejectUpgrade(socket, 404, "Not Found");
    if (! isSameOrigin(req)) return rejectUpgrade(socket, 403, "Forbidden");

    const user= sessions.userFromRequest(req);
    if (! user) return rejectUpgrade(socket, 401, "Unauthorized");

    wss.handleUpgrade(req, socket, head, (ws)=> wss.emit("connection", ws, req, user));
  });

  wss.on("connection", (ws, req, user)=> {
    const connection= {
      send: (message)=> {
        if (ws.readyState=== ws.OPEN) ws.send(JSON.stringify(message));
      },
      close: ()=> ws.close(),
    };

    ws.isAlive= true;
    ws.on("pong", ()=> {
      ws.isAlive= true;
    });

    ws.on("message", (data)=> {
      let message;
      try {
        message= JSON.parse(data);
      }
      catch {
        return connection.send({type: "error", message: "Messages must be JSON."});
      }
      battleManager.handleMessage(user.id, message);
    });

    ws.on("close", ()=> battleManager.disconnect(user.id, connection));

    battleManager.connect(user, connection);
  });

  // drop the connections that stopped answering, so their battles can end
  const heartbeat= setInterval(()=> {
    for (const ws of wss.clients){
      if (! ws.isAlive){
        ws.terminate();
        continue;
      }
      ws.isAlive= false;
      ws.ping();
    }
  }, HEARTBEAT_INTERVAL_MS);
  heartbeat.unref();
  wss.on("close", ()=> clearInterval(heartbeat));

  return wss;
};

module.exports= {attachBattleServer, isSameOrigin};
