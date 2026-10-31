/**
 * Solves a sudoku the way a person would, with logical techniques only (no guessing),
 * always using the easiest technique that makes progress. How hard the puzzle is
 * depends on the hardest technique it needed.
 *
 * Cells are addressed by index (y*9 + x). Candidates are bitmasks: bit n set = n can still go in the cell.
 */

//////                //////
////// board geometry //////
//////                //////

const ROWS= Array.from({length: 9}, (_, y)=> Array.from({length: 9}, (_, x)=> y*9 + x));
const COLUMNS= Array.from({length: 9}, (_, x)=> Array.from({length: 9}, (_, y)=> y*9 + x));
const BOXES= Array.from({length: 9}, (_, box)=> {
  const startX= (box%3)*3;
  const startY= Math.floor(box/3)*3;
  return Array.from({length: 9}, (_, i)=> (startY + Math.floor(i/3))*9 + startX + i%3);
});
const UNITS= [...ROWS, ...COLUMNS, ...BOXES];

const rowOf= (cell)=> Math.floor(cell/9);
const columnOf= (cell)=> cell%9;
const boxOf= (cell)=> Math.floor(rowOf(cell)/3)*3 + Math.floor(columnOf(cell)/3);

const PEERS= Array.from({length: 81}, (_, cell)=> {
  const peers= new Set([...ROWS[rowOf(cell)], ...COLUMNS[columnOf(cell)], ...BOXES[boxOf(cell)]]);
  peers.delete(cell);
  return [...peers];
});
const PEER_SETS= PEERS.map(peers=> new Set(peers));

const ALL_CANDIDATES= 0b1111111110;

//////         //////
////// helpers //////
//////         //////

const bitCount= (mask)=> {
  let count= 0;
  while (mask){
    mask&= mask-1;
    count++;
  }
  return count;
};

const digitsOf= (mask)=> {
  const digits= [];
  for (let digit= 1; digit<=9; digit++){
    if (mask & (1 << digit)) digits.push(digit);
  }
  return digits;
};

/**
 * @returns {Array<Array>} Every combination of `size` elements of the array.
 */
const combinations= (array, size)=> {
  const result= [];
  const pick= (start, chosen)=> {
    if (chosen.length=== size){
      result.push([...chosen]);
      return;
    }
    for (let i= start; i<array.length; i++){
      chosen.push(array[i]);
      pick(i+1, chosen);
      chosen.pop();
    }
  };
  pick(0, []);
  return result;
};

/**
 * The state of the board while solving: placed numbers and remaining candidates.
 */
class SolverState{
  /**
   * @param {(number|null)[][]} puzzle indexed as puzzle[y][x], empty cells are null.
   */
  constructor(puzzle){
    this.values= new Int8Array(81);
    this.candidates= new Uint16Array(81).fill(ALL_CANDIDATES);
    this.broken= false;

    puzzle.flat().forEach((value, cell)=> {
      if (value!== null) this.place(cell, value);
    });
  }

  place(cell, digit){
    if (! (this.candidates[cell] & (1 << digit))) this.broken= true;

    this.values[cell]= digit;
    this.candidates[cell]= 0;
    for (const peer of PEERS[cell]) this.candidates[peer]&= ~(1 << digit);
  }

  /**
   * Removes candidates from a cell.
   * @returns {boolean} Whether anything was removed.
   */
  eliminate(cell, mask){
    if (this.values[cell] || ! (this.candidates[cell] & mask)) return false;

    this.candidates[cell]&= ~mask;
    if (this.candidates[cell]=== 0) this.broken= true;
    return true;
  }

  /**
   * @returns {number[]} The empty cells of the unit where the digit can go.
   */
  positions(unit, digit){
    const bit= 1 << digit;
    return unit.filter(cell=> this.candidates[cell] & bit);
  }

  isSolved(){
    return this.values.every(value=> value!== 0);
  }

  toArray(){
    return Array.from({length: 9}, (_, y)=> Array.from(this.values.slice(y*9, y*9 + 9), value=> value || null));
  }
}

//////            //////
////// techniques //////
//////            //////
// Each technique makes at most one deduction and returns whether it made progress.

const hiddenSingle= (state)=> {
  for (const unit of UNITS){
    for (let digit= 1; digit<=9; digit++){
      const positions= state.positions(unit, digit);
      if (positions.length=== 1){
        state.place(positions[0], digit);
        return true;
      }
    }
  }
  return false;
};

const nakedSingle= (state)=> {
  for (let cell= 0; cell<81; cell++){
    const candidates= state.candidates[cell];
    if (candidates && (candidates & (candidates-1))=== 0){
      state.place(cell, Math.log2(candidates));
      return true;
    }
  }
  return false;
};

/**
 * Pointing: inside a box, a digit is confined to one row (or column), so it can't be elsewhere in that row (or column).
 */
const pointing= (state)=> {
  for (const box of BOXES){
    for (let digit= 1; digit<=9; digit++){
      const positions= state.positions(box, digit);
      if (positions.length< 2) continue;

      for (const [lineOf, lines] of [[rowOf, ROWS], [columnOf, COLUMNS]]){
        const line= lineOf(positions[0]);
        if (! positions.every(cell=> lineOf(cell)=== line)) continue;

        let progress= false;
        for (const cell of lines[line]){
          if (! box.includes(cell)) progress= state.eliminate(cell, 1 << digit) || progress;
        }
        if (progress) return true;
      }
    }
  }
  return false;
};

/**
 * Box/line reduction: inside a row (or column), a digit is confined to one box, so it can't be elsewhere in that box.
 */
const boxLineReduction= (state)=> {
  for (const line of [...ROWS, ...COLUMNS]){
    for (let digit= 1; digit<=9; digit++){
      const positions= state.positions(line, digit);
      if (positions.length< 2) continue;

      const box= boxOf(positions[0]);
      if (! positions.every(cell=> boxOf(cell)=== box)) continue;

      let progress= false;
      for (const cell of BOXES[box]){
        if (! line.includes(cell)) progress= state.eliminate(cell, 1 << digit) || progress;
      }
      if (progress) return true;
    }
  }
  return false;
};

/**
 * Naked pair/triple: n cells of a unit can only hold the same n digits, so those digits can't be elsewhere in the unit.
 */
const nakedSubset= (size)=> (state)=> {
  for (const unit of UNITS){
    const cells= unit.filter(cell=> {
      const count= bitCount(state.candidates[cell]);
      return count>= 2 && count<= size;
    });

    for (const subset of combinations(cells, size)){
      const union= subset.reduce((mask, cell)=> mask | state.candidates[cell], 0);
      if (bitCount(union)!== size) continue;

      let progress= false;
      for (const cell of unit){
        if (! subset.includes(cell)) progress= state.eliminate(cell, union) || progress;
      }
      if (progress) return true;
    }
  }
  return false;
};

/**
 * Hidden pair/triple: n digits can only go in the same n cells of a unit, so those cells can't hold other digits.
 */
const hiddenSubset= (size)=> (state)=> {
  for (const unit of UNITS){
    const digits= [];
    for (let digit= 1; digit<=9; digit++){
      const count= state.positions(unit, digit).length;
      if (count>= 1 && count<= size) digits.push(digit);
    }

    for (const subset of combinations(digits, size)){
      const cells= new Set(subset.flatMap(digit=> state.positions(unit, digit)));
      if (cells.size!== size) continue;

      const keep= subset.reduce((mask, digit)=> mask | (1 << digit), 0);
      let progress= false;
      for (const cell of cells){
        progress= state.eliminate(cell, ALL_CANDIDATES & ~keep) || progress;
      }
      if (progress) return true;
    }
  }
  return false;
};

/**
 * X-Wing (size 2) and Swordfish (size 3): in n rows a digit can only go in the same n columns,
 * so it can't be anywhere else in those columns (and the same swapping rows and columns).
 */
const fish= (size)=> (state)=> {
  for (const [baseLines, coverLines, coverOf] of [[ROWS, COLUMNS, columnOf], [COLUMNS, ROWS, rowOf]]){
    for (let digit= 1; digit<=9; digit++){
      const candidateLines= baseLines
        .map(line=> state.positions(line, digit))
        .filter(positions=> positions.length>= 2 && positions.length<= size);

      for (const lines of combinations(candidateLines, size)){
        const covers= new Set(lines.flat().map(coverOf));
        if (covers.size!== size) continue;

        const baseCells= new Set(lines.flat());
        let progress= false;
        for (const cover of covers){
          for (const cell of coverLines[cover]){
            if (! baseCells.has(cell)) progress= state.eliminate(cell, 1 << digit) || progress;
          }
        }
        if (progress) return true;
      }
    }
  }
  return false;
};

/**
 * XY-Wing: a cell {A,B} sees a cell {A,C} and a cell {B,C}: whatever the first cell is, one of the two holds C,
 * so C can't be in the cells that see both of them.
 */
const xyWing= (state)=> {
  for (let pivot= 0; pivot<81; pivot++){
    const pivotCandidates= state.candidates[pivot];
    if (bitCount(pivotCandidates)!== 2) continue;

    const wings= PEERS[pivot].filter(cell=> {
      const candidates= state.candidates[cell];
      return bitCount(candidates)=== 2 && bitCount(candidates & pivotCandidates)=== 1;
    });

    for (const [first, second] of combinations(wings, 2)){
      const firstCandidates= state.candidates[first];
      const secondCandidates= state.candidates[second];
      const shared= firstCandidates & secondCandidates & ~pivotCandidates;
      if (bitCount(shared)!== 1 || (firstCandidates & secondCandidates & pivotCandidates)) continue;

      let progress= false;
      for (const cell of PEERS[first]){
        if (cell!== second && cell!== pivot && PEER_SETS[second].has(cell)) progress= state.eliminate(cell, shared) || progress;
      }
      if (progress) return true;
    }
  }
  return false;
};

/**
 * XYZ-Wing: a cell {A,B,C} sees a cell {A,C} and a cell {B,C}: one of the three holds C,
 * so C can't be in the cells that see all three of them.
 */
const xyzWing= (state)=> {
  for (let pivot= 0; pivot<81; pivot++){
    const pivotCandidates= state.candidates[pivot];
    if (bitCount(pivotCandidates)!== 3) continue;

    const wings= PEERS[pivot].filter(cell=> {
      const candidates= state.candidates[cell];
      return bitCount(candidates)=== 2 && (candidates & pivotCandidates)=== candidates;
    });

    for (const [first, second] of combinations(wings, 2)){
      const shared= state.candidates[first] & state.candidates[second];
      if (bitCount(shared)!== 1 || (state.candidates[first] | state.candidates[second])!== pivotCandidates) continue;

      let progress= false;
      for (const cell of PEERS[pivot]){
        if (cell!== first && cell!== second && PEER_SETS[first].has(cell) && PEER_SETS[second].has(cell)){
          progress= state.eliminate(cell, shared) || progress;
        }
      }
      if (progress) return true;
    }
  }
  return false;
};

/**
 * The techniques, easiest first. `tier` is the difficulty they belong to (1 easy - 4 expert),
 * `points` how much each use adds to the puzzle's score.
 */
const TECHNIQUES= Object.freeze([
  {name: "Hidden single", tier: 1, points: 1, apply: hiddenSingle},
  {name: "Naked single", tier: 1, points: 2, apply: nakedSingle},
  {name: "Pointing", tier: 2, points: 5, apply: pointing},
  {name: "Box/line reduction", tier: 2, points: 5, apply: boxLineReduction},
  {name: "Naked pair", tier: 2, points: 6, apply: nakedSubset(2)},
  {name: "Hidden pair", tier: 2, points: 8, apply: hiddenSubset(2)},
  {name: "Naked triple", tier: 3, points: 10, apply: nakedSubset(3)},
  {name: "Hidden triple", tier: 3, points: 12, apply: hiddenSubset(3)},
  {name: "X-Wing", tier: 3, points: 14, apply: fish(2)},
  {name: "XY-Wing", tier: 4, points: 18, apply: xyWing},
  {name: "XYZ-Wing", tier: 4, points: 20, apply: xyzWing},
  {name: "Swordfish", tier: 4, points: 22, apply: fish(3)},
]);

const MAX_TIER= 4;

/**
 * @typedef {Object} SolveResult
 * @property {boolean} solved Whether logic alone was enough. If so, the puzzle has exactly one solution.
 * @property {number} tier The tier of the hardest technique used (0 when nothing had to be solved).
 * @property {string|null} hardestTechnique Its name.
 * @property {number} score The sum of the points of every step.
 * @property {Object<string, number>} techniques How many times each technique was used.
 * @property {(number|null)[][]} board The board where the solver stopped.
 */

/**
 * Solves a puzzle with logical techniques, easiest first.
 *
 * @param {(number|null)[][]} puzzle indexed as puzzle[y][x], empty cells are null.
 * @param {number} [maxTier] Only use the techniques up to this tier.
 * @returns {SolveResult}
 */
const solveLogically= (puzzle, maxTier= MAX_TIER)=> {
  const state= new SolverState(puzzle);
  const allowed= TECHNIQUES.filter(technique=> technique.tier<= maxTier);
  const result= {solved: false, tier: 0, hardestTechnique: null, score: 0, techniques: {}};
  let hardestPoints= 0;

  while (! state.broken && ! state.isSolved()){
    const technique= allowed.find(candidate=> candidate.apply(state));
    if (! technique) break;

    result.techniques[technique.name]= (result.techniques[technique.name] ?? 0) + 1;
    result.score+= technique.points;
    if (technique.tier> result.tier || (technique.tier=== result.tier && technique.points> hardestPoints)){
      result.tier= technique.tier;
      result.hardestTechnique= technique.name;
      hardestPoints= technique.points;
    }
  }

  result.solved= ! state.broken && state.isSolved();
  result.board= state.toArray();
  return result;
};

module.exports= {solveLogically, SolverState, TECHNIQUES, MAX_TIER};
