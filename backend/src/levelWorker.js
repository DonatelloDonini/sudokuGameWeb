const {parentPort}= require("node:worker_threads");
const {generateLevel}= require("./levelGenerator");

// generates the levels asked by the LevelPool, off the main thread
parentPort.on("message", ({difficulty})=> {
  parentPort.postMessage({difficulty, level: generateLevel(difficulty)});
});
