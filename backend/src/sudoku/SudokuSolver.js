/**
 * Fast backtracking solver working on plain 9x9 arrays, used to make sure a level has exactly one solution.
 * Rows, columns and quadrants are tracked as bitmasks (bit n set = digit n already used).
 */

const ALL_DIGITS_MASK= 0b1111111110;

const quadrantIndex= (x, y)=> Math.floor(y/3)*3 + Math.floor(x/3);

const countBits= (mask)=> {
  let count= 0;
  while (mask){
    mask&= mask-1;
    count++;
  }
  return count;
};

/**
 * Searches the solutions of a sudoku, stopping as soon as `limit` solutions are found.
 *
 * @param {list[list[number|null]]} matrix The sudoku, indexed as matrix[y][x], empty cells are null.
 * @param {number} limit The number of solutions after which the search stops.
 * @returns {{count: number, firstSolution: list[list[number]]|null}} How many solutions were found (never more than
 *          `limit`, 0 if the givens already break the rules) and the first one.
 */
const searchSolutions= (matrix, limit)=> {
  const values= matrix.map(row=> [...row]);
  const rows= new Array(9).fill(0);
  const columns= new Array(9).fill(0);
  const quadrants= new Array(9).fill(0);
  const emptyCells= [];

  for (let y= 0; y<9; y++){
    for (let x= 0; x<9; x++){
      const value= values[y][x];
      if (value=== null){
        emptyCells.push([x, y]);
        continue;
      }

      const bit= 1 << value;
      const q= quadrantIndex(x, y);
      if ((rows[y] | columns[x] | quadrants[q]) & bit) return {count: 0, firstSolution: null};

      rows[y]|= bit;
      columns[x]|= bit;
      quadrants[q]|= bit;
    }
  }

  let solutions= 0;
  let firstSolution= null;

  const search= ()=> {
    // pick the empty cell with the fewest candidates
    let bestIndex= -1;
    let bestCandidates= 0;
    let bestCount= 10;
    for (let i= 0; i<emptyCells.length; i++){
      const [x, y]= emptyCells[i];
      if (x=== -1) continue;

      const candidates= ALL_DIGITS_MASK & ~(rows[y] | columns[x] | quadrants[quadrantIndex(x, y)]);
      const count= countBits(candidates);
      if (count=== 0) return;
      if (count< bestCount){
        bestIndex= i;
        bestCandidates= candidates;
        bestCount= count;
        if (count=== 1) break;
      }
    }

    if (bestIndex=== -1){
      solutions++;
      if (solutions=== 1) firstSolution= values.map(row=> [...row]);
      return;
    }

    const [x, y]= emptyCells[bestIndex];
    const q= quadrantIndex(x, y);
    emptyCells[bestIndex]= [-1, -1];

    for (let digit= 1; digit<=9 && solutions< limit; digit++){
      const bit= 1 << digit;
      if (! (bestCandidates & bit)) continue;

      rows[y]|= bit;
      columns[x]|= bit;
      quadrants[q]|= bit;
      values[y][x]= digit;
      search();
      values[y][x]= null;
      rows[y]&= ~bit;
      columns[x]&= ~bit;
      quadrants[q]&= ~bit;
    }

    emptyCells[bestIndex]= [x, y];
  };

  search();
  return {count: solutions, firstSolution};
};

/**
 * Counts the solutions of a sudoku, stopping as soon as `limit` solutions are found.
 *
 * @param {list[list[number|null]]} matrix The sudoku, indexed as matrix[y][x], empty cells are null.
 * @param {number} limit The number of solutions after which the search stops.
 * @returns {number} The number of solutions found, never more than `limit`. 0 if the givens already break the rules.
 */
const countSolutions= (matrix, limit= 2)=> searchSolutions(matrix, limit).count;

/**
 * Solves a sudoku by backtracking.
 *
 * @param {list[list[number|null]]} matrix The sudoku, indexed as matrix[y][x], empty cells are null.
 * @returns {{solutions: number, solution: list[list[number]]|null}} `solutions` is 0, 1, or 2 for "more than one";
 *          `solution` is the solution found first (null if there is none).
 */
const solve= (matrix)=> {
  const {count, firstSolution}= searchSolutions(matrix, 2);
  return {solutions: count, solution: firstSolution};
};

/**
 * @param {list[list[number|null]]} matrix The sudoku, indexed as matrix[y][x], empty cells are null.
 * @returns {boolean} Whether the sudoku has one and only one solution.
 */
const hasUniqueSolution= (matrix)=> countSolutions(matrix, 2)=== 1;

module.exports= {countSolutions, hasUniqueSolution, solve};
