const {test}= require("node:test");
const assert= require("node:assert/strict");
const {generateLevel}= require("../src/levelGenerator");

const ALL_DIGITS= [1, 2, 3, 4, 5, 6, 7, 8, 9];

const assertHasAllDigits= (cells, areaName)=> {
  assert.deepEqual([...cells].sort(), ALL_DIGITS, `${areaName} must contain every digit once`);
};

test("the solution is a valid, complete sudoku", ()=> {
  for (let attempt= 0; attempt<50; attempt++){
    const {solution}= generateLevel(6);

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

test("the puzzle only contains numbers from the solution", ()=> {
  const {puzzle, solution}= generateLevel(6);

  for (let y= 0; y<9; y++){
    for (let x= 0; x<9; x++){
      if (puzzle[y][x]!== null) assert.equal(puzzle[y][x], solution[y][x]);
    }
  }
});

test("the difficulty sets how many cells are emptied per row", ()=> {
  for (const difficulty of [0, 3, 6, 9]){
    const {puzzle}= generateLevel(difficulty);

    for (const row of puzzle){
      const emptyCells= row.filter(cell=> cell=== null).length;
      assert.ok(emptyCells<= difficulty, `a row has ${emptyCells} empty cells with difficulty ${difficulty}`);
    }
  }

  const emptyCellsWithZeroDifficulty= generateLevel(0).puzzle.flat().filter(cell=> cell=== null).length;
  assert.equal(emptyCellsWithZeroDifficulty, 0);
});
