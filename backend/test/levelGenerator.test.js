const {test}= require("node:test");
const assert= require("node:assert/strict");
const {generateLevel, DIFFICULTIES}= require("../src/levelGenerator");
const {hasUniqueSolution}= require("../src/sudoku/SudokuSolver");

const ALL_DIGITS= [1, 2, 3, 4, 5, 6, 7, 8, 9];

const assertHasAllDigits= (cells, areaName)=> {
  assert.deepEqual([...cells].sort(), ALL_DIGITS, `${areaName} must contain every digit once`);
};

test("the solution is a valid, complete sudoku", ()=> {
  for (let attempt= 0; attempt<20; attempt++){
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

test("every difficulty gives a puzzle with a single solution matching the solution", ()=> {
  for (const [difficulty, target] of Object.entries(DIFFICULTIES)){
    for (let attempt= 0; attempt<5; attempt++){
      const {puzzle, solution}= generateLevel(difficulty);
      const empty= puzzle.flat().filter(cell=> cell=== null).length;

      assert.ok(empty<= target, `${difficulty}: ${empty} empty cells, target ${target}`);
      assert.ok(empty>= Math.min(target, 50), `${difficulty}: only ${empty} empty cells`);
      assert.equal(hasUniqueSolution(puzzle), true);
      puzzle.forEach((row, y)=> row.forEach((cell, x)=> {
        if (cell!== null) assert.equal(cell, solution[y][x]);
      }));
    }
  }
});

test("harder difficulties empty more cells", ()=> {
  const emptyCells= (difficulty)=> generateLevel(difficulty).puzzle.flat().filter(cell=> cell=== null).length;
  assert.ok(emptyCells("easy")< emptyCells("medium"));
  assert.ok(emptyCells("medium")< emptyCells("hard"));
});

test("unknown difficulties are rejected", ()=> {
  assert.throws(()=> generateLevel("impossible"));
});
