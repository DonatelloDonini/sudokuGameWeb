const {createApp}= require("./app");

const PORT= Number(process.env.PORT) || 3000;
const HOST= process.env.HOST || "0.0.0.0";

const server= createApp({frontendDir: process.env.FRONTEND_DIR}).listen(PORT, HOST, ()=> {
  console.log(`Sudoku server listening on http://${HOST}:${PORT}`);
});

// let `docker stop` shut the server down cleanly instead of waiting for the kill timeout
for (const signal of ["SIGINT", "SIGTERM"]){
  process.on(signal, ()=> {
    console.log(`Received ${signal}, shutting down`);
    server.close(()=> process.exit(0));
  });
}
