const SudokuGrid= require("./sudoku/SudokuGrid");
const {solveLogically, TECHNIQUES}= require("./sudoku/HumanSolver");

/**
 * The difficulties are defined by the reasoning a level needs, not by how many cells are empty:
 * `tier` is the hardest group of techniques the player must use (see HumanSolver), and every level
 * of a difficulty needs at least one technique of its tier.
 * Easy levels also keep more numbers, so they are quick as well as simple.
 */
const DIFFICULTIES= Object.freeze({
  easy: {tier: 1, maxEmptyCells: 45},
  medium: {tier: 2, maxEmptyCells: 81},
  hard: {tier: 3, maxEmptyCells: 81},
  expert: {tier: 4, maxEmptyCells: 81},
});

const DEFAULT_DIFFICULTY= "medium";

/**
 * Levels needing a given tier are rare for the harder ones (about 1 attempt in 40 for "hard"),
 * after this many attempts the hardest level found is used.
 */
const MAX_ATTEMPTS= 2000;

/**
 * @param {string} difficulty
 * @returns {boolean} Whether the difficulty is one of the available ones.
 */
const isValidDifficulty= (difficulty)=> Object.hasOwn(DIFFICULTIES, difficulty);

/**
 * @returns {Object<string, string[]>} For each difficulty, the techniques of its tier.
 */
const techniquesByDifficulty= ()=> Object.fromEntries(Object.entries(DIFFICULTIES).map(([difficulty, {tier}])=> [
  difficulty,
  TECHNIQUES.filter(technique=> technique.tier=== tier).map(technique=> technique.name),
]));

/**
 * @typedef {Object} Level
 * @property {string} difficulty
 * @property {(number|null)[][]} puzzle indexed as puzzle[y][x], empty cells are null.
 * @property {number[][]} solution
 * @property {{tier: number, hardestTechnique: string, score: number, techniques: Object<string, number>}} grade
 *           How the level is solved: its hardest technique and how many times each technique is needed.
 */

/**
 * Generates a new level: a random solved grid is emptied as long as the level can still be solved with the techniques
 * of the difficulty, and it is kept only if it really needs a technique of the difficulty's tier.
 *
 * @param {string} difficulty One of the DIFFICULTIES keys.
 * @returns {Level}
 */
const generateLevel= (difficulty= DEFAULT_DIFFICULTY)=> {
  if (! isValidDifficulty(difficulty)) throw new Error(`Unknown difficulty: ${difficulty}`);

  const {tier, maxEmptyCells}= DIFFICULTIES[difficulty];
  let best= null;

  for (let attempt= 0; attempt<MAX_ATTEMPTS; attempt++){
    const solvedGrid= new SudokuGrid();
    solvedGrid.generateLevel();

    const unsolvedGrid= solvedGrid.copy();
    unsolvedGrid.unsolveLogically(tier, maxEmptyCells);

    const puzzle= unsolvedGrid.toArray();
    const {board, solved, ...grade}= solveLogically(puzzle, tier);
    const level= {difficulty, puzzle, solution: solvedGrid.toArray(), grade};

    if (grade.tier=== tier) return level;
    if (! best || grade.tier> best.grade.tier) best= level;
  }

  return best;
};

module.exports= {generateLevel, isValidDifficulty, techniquesByDifficulty, DIFFICULTIES, DEFAULT_DIFFICULTY};
