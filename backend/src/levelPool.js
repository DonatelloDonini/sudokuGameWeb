const path= require("node:path");
const {Worker}= require("node:worker_threads");
const {generateLevel, DIFFICULTIES}= require("./levelGenerator");

/**
 * Thrown when too many levels are already waiting to be generated.
 */
class LevelQueueFullError extends Error{
  constructor(){
    super("Too many levels are being generated, retry in a few seconds.");
    this.name= "LevelQueueFullError";
  }
}

/**
 * Generates the levels in a worker thread (hard levels can take a second to find, the server shouldn't freeze):
 * - take() serves the game and the battles from a few levels of every difficulty kept ready;
 * - generate() serves the public API with fresh levels, without emptying what the players need.
 */
class LevelPool{
  /**
   * @param {Object} [options]
   * @param {number} [options.size] How many levels to keep ready per difficulty.
   * @param {number} [options.maxQueued] How many generate() requests can wait at the same time.
   */
  constructor({size= 5, maxQueued= 50}= {}){
    this.size= size;
    this.maxQueued= maxQueued;
    this.levels= Object.fromEntries(Object.keys(DIFFICULTIES).map(difficulty=> [difficulty, []]));
    this.worker= null;
    /** @type {{difficulty: string, resolve: Function, reject: Function}[]} generate() requests waiting for the worker */
    this.queue= [];
    /** @type {{difficulty: string, resolve: Function, reject: Function}|null} the job the worker is doing */
    this.currentJob= null;
  }

  start(){
    this.worker= new Worker(path.join(__dirname, "levelWorker.js"));
    this.worker.unref();

    this.worker.on("message", ({level})=> {
      const job= this.currentJob;
      this.currentJob= null;
      job.resolve(level);
      this._next();
    });

    // without the worker the levels are generated on demand
    this.worker.on("error", (error)=> {
      console.error("level worker crashed, generating levels on demand from now on", error);
      this.worker= null;
      const jobs= [this.currentJob, ...this.queue].filter(Boolean);
      this.currentJob= null;
      this.queue= [];
      jobs.forEach(job=> this._generateNow(job));
    });

    this._next();
  }

  async stop(){
    const worker= this.worker;
    this.worker= null;
    await worker?.terminate();
  }

  /**
   * @param {string} difficulty
   * @returns {import("./levelGenerator").Level} A ready level, or a freshly generated one if none is ready.
   */
  take(difficulty){
    const level= this.levels[difficulty].shift() ?? generateLevel(difficulty);
    this._next();
    return level;
  }

  /**
   * Generates a new level, waiting for the worker.
   * @param {string} difficulty
   * @returns {Promise<import("./levelGenerator").Level>}
   * @throws {LevelQueueFullError} (as a rejection) If too many levels are already waiting.
   */
  generate(difficulty){
    return new Promise((resolve, reject)=> {
      const job= {difficulty, resolve, reject};
      if (! this.worker) return this._generateNow(job);
      if (this.queue.length>= this.maxQueued) return reject(new LevelQueueFullError());

      this.queue.push(job);
      this._next();
    });
  }

  _generateNow(job){
    try {
      job.resolve(generateLevel(job.difficulty));
    }
    catch (error) {
      job.reject(error);
    }
  }

  /**
   * Gives the worker its next job: the waiting generate() requests first,
   * then a level for the difficulty with the fewest ready levels.
   */
  _next(){
    if (! this.worker || this.currentJob) return;

    if (this.queue.length> 0){
      this.currentJob= this.queue.shift();
    }
    else{
      const [difficulty, levels]= Object.entries(this.levels).sort((a, b)=> a[1].length - b[1].length)[0];
      if (levels.length>= this.size) return;

      this.currentJob= {difficulty, resolve: (level)=> levels.push(level), reject: ()=> {}};
    }

    this.worker.postMessage({difficulty: this.currentJob.difficulty});
  }
}

module.exports= {LevelPool, LevelQueueFullError};
