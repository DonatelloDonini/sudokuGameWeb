const {test}= require("node:test");
const assert= require("node:assert/strict");
const {generateLevel, techniquesByDifficulty, DIFFICULTIES}= require("../src/levelGenerator");
const {solveLogically}= require("../src/sudoku/HumanSolver");
const {hasUniqueSolution}= require("../src/sudoku/SudokuSolver");

const ALL_DIGITS= [1, 2, 3, 4, 5, 6, 7, 8, 9];

const assertHasAllDigits= (cells, areaName)=> {
  assert.deepEqual([...cells].sort(), ALL_DIGITS, `${areaName} must contain every digit once`);
};

test("the solution is a valid, complete sudoku", ()=> {
  for (let attempt= 0; attempt<10; attempt++){
    const {solution}= generateLevel("easy");

    for (let i= 0; i<9; i++){
      assertHasAllDigits(solution[i], `row ${i}`);
      assertHasAllDigits(solution.map(row=> row[i]), `column ${i}`);

      const quadrantX= (i%3)*3;
      const quadrantY= Math.floor(i/3)*3;
      const quadrant= [];
      for (let y= quadrantY; y<quadrantY+3; y++){
        quadrant.push(...solution[y].slice(quadrantX, quadrantX+3));
      }
      assertHasAllDigits(quadrant, `quadrant ${i}`);
    }
  }
});

test("every difficulty needs a technique of its tier, and nothing harder", ()=> {
  for (const [difficulty, {tier}] of Object.entries(DIFFICULTIES)){
    for (let attempt= 0; attempt<3; attempt++){
      const {puzzle, solution, grade}= generateLevel(difficulty);

      assert.equal(grade.tier, tier, `${difficulty} level graded ${grade.tier}`);
      assert.ok(techniquesByDifficulty()[difficulty].includes(grade.hardestTechnique));
      assert.equal(solveLogically(puzzle, tier).solved, true, `${difficulty} level can be solved within its tier`);
      assert.equal(solveLogically(puzzle, tier - 1).solved, false, `${difficulty} level can't be solved with easier techniques`);
      assert.equal(hasUniqueSolution(puzzle), true);
      assert.deepEqual(solveLogically(puzzle).board, solution);
    }
  }
});

test("easy levels keep more numbers", ()=> {
  for (let attempt= 0; attempt<5; attempt++){
    const empty= generateLevel("easy").puzzle.flat().filter(cell=> cell=== null).length;
    assert.ok(empty<= DIFFICULTIES.easy.maxEmptyCells);
  }
});

test("unknown difficulties are rejected", ()=> {
  assert.throws(()=> generateLevel("impossible"));
});
