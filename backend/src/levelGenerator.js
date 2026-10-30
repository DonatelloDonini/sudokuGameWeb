const SudokuGrid= require("./sudoku/SudokuGrid");

const MIN_DIFFICULTY= 0;
const MAX_DIFFICULTY= 9;
const DEFAULT_DIFFICULTY= 6;

/**
 * Generates a new Sudoku level.
 * @param {number} difficulty How many numbers to delete per row, column and quadrant (0-9).
 * @returns {{difficulty: number, puzzle: list[list[number|null]], solution: list[list[number]]}}
 *          The grids are indexed as grid[y][x]; empty cells in the puzzle are null.
 */
const generateLevel= (difficulty= DEFAULT_DIFFICULTY)=> {
  const solvedGrid= new SudokuGrid();
  solvedGrid.generateLevel();

  const unsolvedGrid= solvedGrid.copy();
  unsolvedGrid.unsolve(difficulty);

  return {
    difficulty,
    puzzle: unsolvedGrid.toArray(),
    solution: solvedGrid.toArray(),
  };
};

module.exports= {generateLevel, MIN_DIFFICULTY, MAX_DIFFICULTY, DEFAULT_DIFFICULTY};
