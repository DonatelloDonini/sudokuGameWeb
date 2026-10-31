/**
 * The levels kept on the device for offline play: a fixed number per difficulty, downloaded from the public API
 * (they come with their solution, so they can be checked without the server) and refilled when online.
 */
export default class OfflineLevels{
  static STORAGE_KEY= "sudoku-offline-levels";
  static PER_DIFFICULTY= 5;
  static DIFFICULTIES= Object.freeze(["easy", "medium", "hard", "expert"]);

  /**
   * @param {Object} [options]
   * @param {Storage} [options.storage] Where the levels are kept (localStorage by default).
   * @param {Function} [options.fetchLevels] (difficulty, count) => Promise of levels {puzzle, solution, hardestTechnique}.
   */
  constructor({storage= globalThis.localStorage, fetchLevels= OfflineLevels.fetchFromApi}= {}){
    this.storage= storage;
    this.fetchLevels= fetchLevels;
    this.refilling= null;
  }

  /**
   * Downloads levels from the public API.
   */
  static async fetchFromApi(difficulty, count){
    const response= await fetch(`/api/v1/puzzles?difficulty=${difficulty}&count=${count}`);
    if (! response.ok) throw new Error(`Can't download levels (HTTP ${response.status}).`);
    return (await response.json()).puzzles;
  }

  /**
   * @returns {Object<string, Object[]>} The stored levels, by difficulty.
   */
  #load(){
    try {
      const stored= JSON.parse(this.storage.getItem(OfflineLevels.STORAGE_KEY) ?? "{}");
      return Object.fromEntries(OfflineLevels.DIFFICULTIES.map(difficulty=> [difficulty, Array.isArray(stored[difficulty]) ? stored[difficulty] : []]));
    }
    catch {
      return Object.fromEntries(OfflineLevels.DIFFICULTIES.map(difficulty=> [difficulty, []]));
    }
  }

  #save(levels){
    try {
      this.storage.setItem(OfflineLevels.STORAGE_KEY, JSON.stringify(levels));
    }
    catch {}
  }

  /**
   * @param {string} [difficulty] Only this difficulty (default: all of them).
   * @returns {number} How many levels are ready offline.
   */
  count(difficulty){
    const levels= this.#load();
    return difficulty ? levels[difficulty]?.length ?? 0 : Object.values(levels).reduce((total, list)=> total + list.length, 0);
  }

  /**
   * Removes a level from the device to play it.
   * @param {string} difficulty
   * @param {Object} [options]
   * @param {boolean} [options.anyDifficulty] When none of this difficulty is left, take one of the closest difficulty.
   * @returns {{difficulty: string, puzzle: number[][], solution: number[][], hardestTechnique: string}|null}
   */
  take(difficulty, {anyDifficulty= true}= {}){
    const levels= this.#load();
    const order= OfflineLevels.DIFFICULTIES;
    const candidates= anyDifficulty
      ? [...order].sort((a, b)=> Math.abs(order.indexOf(a) - order.indexOf(difficulty)) - Math.abs(order.indexOf(b) - order.indexOf(difficulty)))
      : [difficulty];

    for (const candidate of candidates){
      const level= levels[candidate]?.shift();
      if (level){
        this.#save(levels);
        return {...level, difficulty: candidate};
      }
    }
    return null;
  }

  /**
   * Downloads the missing levels. Calls made while a refill is running wait for it.
   * @returns {Promise<number>} How many levels were added.
   */
  refill(){
    this.refilling??= this.#refill().finally(()=> {
      this.refilling= null;
    });
    return this.refilling;
  }

  async #refill(){
    let added= 0;
    for (const difficulty of OfflineLevels.DIFFICULTIES){
      const missing= OfflineLevels.PER_DIFFICULTY - this.count(difficulty);
      if (missing<= 0) continue;

      const fetched= await this.fetchLevels(difficulty, missing);
      // read again: a level may have been taken during the download
      const levels= this.#load();
      const kept= fetched.slice(0, Math.max(0, OfflineLevels.PER_DIFFICULTY - levels[difficulty].length));
      levels[difficulty].push(...kept.map(({puzzle, solution, hardestTechnique})=> ({puzzle, solution, hardestTechnique})));
      this.#save(levels);
      added+= kept.length;
    }
    return added;
  }
}
