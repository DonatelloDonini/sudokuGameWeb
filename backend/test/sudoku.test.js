const {test, describe}= require("node:test");
const assert= require("node:assert/strict");
const SudokuGrid= require("../src/sudoku/SudokuGrid");
const NumberPossibilities= require("../src/sudoku/NumberPossibilities");
const Possibilities= require("../src/sudoku/Possibilities");
const {countSolutions, hasUniqueSolution}= require("../src/sudoku/SudokuSolver");
const {CoordOutOfBoundsError, NotImplementedError, NumberNotIntegerError}= require("../src/sudoku/CustomErrors");
const {SOLUTION, copy}= require("./helpers");

const gridFrom= (matrix)=> {
  const grid= new SudokuGrid();
  matrix.forEach((row, y)=> row.forEach((value, x)=> {
    if (value!== null) grid.set(value, [x, y]);
  }));
  return grid;
};

describe("SudokuGrid", ()=> {
  test("isValid accepts a solved grid", ()=> {
    assert.equal(gridFrom(SOLUTION).isValid(), true);
  });

  test("isValid checks every row and column, not only the first ones", ()=> {
    const grid= gridFrom(SOLUTION);
    grid.deleteElement([4, 7]);
    assert.equal(grid.isValid(), false);
  });

  test("copy works on a grid with empty cells", ()=> {
    const matrix= copy(SOLUTION);
    matrix[0][0]= null;
    matrix[8][8]= null;

    const original= gridFrom(matrix);
    assert.deepEqual(original.copy().toArray(), matrix);
  });

  test("set rejects non integer numbers with a correctly named error", ()=> {
    assert.throws(()=> new SudokuGrid().set(2.5, [0, 0]), NumberNotIntegerError);
  });

  test("coordinates out of the grid throw CoordOutOfBoundsError", ()=> {
    assert.throws(()=> new SudokuGrid().get([9, 0]), (error)=> error instanceof CoordOutOfBoundsError && error.name=== "CoordOutOfBoundsError");
  });

  test("generateLevel fills a valid grid", ()=> {
    for (let i= 0; i<30; i++){
      const grid= new SudokuGrid();
      grid.generateLevel();
      assert.equal(grid.isValid(), true);
    }
  });

  test("generateLevel doesn't swallow unexpected errors", ()=> {
    const grid= new SudokuGrid();
    grid._getBestOption= ()=> {
      throw new TypeError("a real bug");
    };
    assert.throws(()=> grid.generateLevel(), TypeError);
  });

  test("unsolve empties the requested cells and keeps a single solution", ()=> {
    for (const target of [0, 30, 50]){
      const grid= gridFrom(SOLUTION);
      const emptied= grid.unsolve(target);

      assert.equal(emptied, target);
      assert.equal(grid.toArray().flat().filter(cell=> cell=== null).length, target);
      assert.equal(hasUniqueSolution(grid.toArray()), true);
    }
  });

  test("unsolve rejects impossible targets", ()=> {
    assert.throws(()=> gridFrom(SOLUTION).unsolve(82));
    assert.throws(()=> gridFrom(SOLUTION).unsolve(-1));
  });
});

describe("Possibilities", ()=> {
  test("subclasses are initialized once", ()=> {
    let calls= 0;
    class CountingPossibilities extends NumberPossibilities{
      _initialize(){
        calls++;
        super._initialize();
      }
    }

    const grid= new SudokuGrid();
    new CountingPossibilities(grid, 0);
    assert.equal(calls, 1);
  });

  test("a subclass that doesn't define its possibilities fails loudly", ()=> {
    class Broken extends Possibilities{
      _initialize(){}
    }
    assert.throws(()=> new Broken(new SudokuGrid(), 0), NotImplementedError);
  });

  test("_isSameCoord compares both coordinates", ()=> {
    const possibilities= new NumberPossibilities(new SudokuGrid(), 0);
    assert.equal(possibilities._isSameCoord([1, 2], [1, 2]), true);
    assert.equal(possibilities._isSameCoord([1, 2], [1, 3]), false);
  });

  test("getOptionsGroup sorts the groups numerically", ()=> {
    const possibilities= new NumberPossibilities(new SudokuGrid(), 0);
    possibilities._possibilities= {10: {a: new Set()}, 9: {b: new Set()}, 2: {c: new Set()}};
    assert.deepEqual(Object.keys(possibilities.getOptionsGroup(0)), ["c"]);
    assert.deepEqual(Object.keys(possibilities.getOptionsGroup(1)), ["b"]);
    assert.deepEqual(Object.keys(possibilities.getOptionsGroup(2)), ["a"]);
  });

  test("the possibilities use their own grid, not a global one", ()=> {
    const grid= gridFrom(SOLUTION);
    grid.clearRow(4);
    assert.equal(new NumberPossibilities(grid, 4).areEnough(), true);
  });
});

describe("SudokuSolver", ()=> {
  test("a full grid has one solution", ()=> {
    assert.equal(countSolutions(SOLUTION), 1);
  });

  test("an empty grid has many solutions", ()=> {
    assert.equal(countSolutions(Array.from({length: 9}, ()=> new Array(9).fill(null)), 2), 2);
  });

  test("a grid breaking the rules has no solution", ()=> {
    const broken= copy(SOLUTION);
    broken[0][0]= broken[0][1];
    assert.equal(countSolutions(broken), 0);
  });
});
