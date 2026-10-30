const SudokuGrid= require("./sudoku/SudokuGrid");

/**
 * Available difficulties, as the number of cells emptied in the solved grid.\
 * Every level has a single solution, so on "expert" the target is not always reached (54-58 empty cells).
 */
const DIFFICULTIES= Object.freeze({
  easy: 36,
  medium: 46,
  hard: 52,
  expert: 58,
});

const DEFAULT_DIFFICULTY= "medium";

/**
 * @param {string} difficulty
 * @returns {boolean} Whether the difficulty is one of the available ones.
 */
const isValidDifficulty= (difficulty)=> Object.hasOwn(DIFFICULTIES, difficulty);

/**
 * Generates a new Sudoku level with a single solution.
 * @param {string} difficulty One of the DIFFICULTIES keys.
 * @returns {{difficulty: string, puzzle: list[list[number|null]], solution: list[list[number]]}}
 *          The grids are indexed as grid[y][x]; empty cells in the puzzle are null.
 */
const generateLevel= (difficulty= DEFAULT_DIFFICULTY)=> {
  if (! isValidDifficulty(difficulty)) throw new Error(`Unknown difficulty: ${difficulty}`);

  const solvedGrid= new SudokuGrid();
  solvedGrid.generateLevel();

  const unsolvedGrid= solvedGrid.copy();
  unsolvedGrid.unsolve(DIFFICULTIES[difficulty]);

  return {
    difficulty,
    puzzle: unsolvedGrid.toArray(),
    solution: solvedGrid.toArray(),
  };
};

module.exports= {generateLevel, isValidDifficulty, DIFFICULTIES, DEFAULT_DIFFICULTY};
