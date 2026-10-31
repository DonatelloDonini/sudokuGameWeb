const {test, describe}= require("node:test");
const assert= require("node:assert/strict");
const {solveLogically, SolverState, TECHNIQUES}= require("../src/sudoku/HumanSolver");
const SudokuGrid= require("../src/sudoku/SudokuGrid");
const {SOLUTION, copy}= require("./helpers");

const EMPTY= Array.from({length: 9}, ()=> new Array(9).fill(null));
const cell= (x, y)=> y*9 + x;
const bit= (digit)=> 1 << digit;
const mask= (...digits)=> digits.reduce((result, digit)=> result | bit(digit), 0);

const technique= (name)=> TECHNIQUES.find(candidate=> candidate.name=== name);

/** An empty board where every cell can hold every digit, to build the patterns by hand. */
const emptyState= ()=> new SolverState(EMPTY);

/** Removes a digit from the candidates of the given cells. */
const removeDigit= (state, digit, cells)=> cells.forEach(index=> {
  state.candidates[index]&= ~bit(digit);
});

const hasCandidate= (state, index, digit)=> (state.candidates[index] & bit(digit))!== 0;

describe("techniques", ()=> {
  test("hidden single: a digit with one place left in a row is placed there", ()=> {
    const state= emptyState();
    removeDigit(state, 4, [1, 2, 3, 4, 5, 6, 7, 8].map(x=> cell(x, 0)));

    assert.equal(technique("Hidden single").apply(state), true);
    assert.equal(state.values[cell(0, 0)], 4);
  });

  test("naked single: a cell with one candidate gets it", ()=> {
    const state= emptyState();
    state.candidates[cell(4, 4)]= mask(7);

    assert.equal(technique("Naked single").apply(state), true);
    assert.equal(state.values[cell(4, 4)], 7);
  });

  test("pointing: a digit confined to one row of a box leaves the rest of the row", ()=> {
    const state= emptyState();
    // in the first box, 4 can only be in the first row
    removeDigit(state, 4, [cell(0, 1), cell(1, 1), cell(2, 1), cell(0, 2), cell(1, 2), cell(2, 2)]);

    assert.equal(technique("Pointing").apply(state), true);
    assert.equal(hasCandidate(state, cell(5, 0), 4), false);
    assert.equal(hasCandidate(state, cell(1, 0), 4), true);
  });

  test("box/line reduction: a digit confined to one box of a row leaves the rest of the box", ()=> {
    const state= emptyState();
    removeDigit(state, 6, [3, 4, 5, 6, 7, 8].map(x=> cell(x, 0)));

    assert.equal(technique("Box/line reduction").apply(state), true);
    assert.equal(hasCandidate(state, cell(1, 2), 6), false);
    assert.equal(hasCandidate(state, cell(1, 0), 6), true);
  });

  test("naked pair: two cells holding the same two digits remove them from their row", ()=> {
    const state= emptyState();
    state.candidates[cell(0, 0)]= mask(2, 3);
    state.candidates[cell(1, 0)]= mask(2, 3);

    assert.equal(technique("Naked pair").apply(state), true);
    assert.equal(state.candidates[cell(5, 0)], mask(1, 4, 5, 6, 7, 8, 9));
  });

  test("hidden pair: two digits with the same two places remove the other candidates of those cells", ()=> {
    const state= emptyState();
    removeDigit(state, 8, [2, 3, 4, 5, 6, 7, 8].map(x=> cell(x, 0)));
    removeDigit(state, 9, [2, 3, 4, 5, 6, 7, 8].map(x=> cell(x, 0)));

    assert.equal(technique("Hidden pair").apply(state), true);
    assert.equal(state.candidates[cell(0, 0)], mask(8, 9));
    assert.equal(state.candidates[cell(1, 0)], mask(8, 9));
  });

  test("X-Wing: a digit in the same two columns of two rows leaves the rest of the columns", ()=> {
    const state= emptyState();
    const others= [0, 2, 3, 4, 5, 6, 8];
    removeDigit(state, 5, [...others.map(x=> cell(x, 0)), ...others.map(x=> cell(x, 4))]);

    assert.equal(technique("X-Wing").apply(state), true);
    assert.equal(hasCandidate(state, cell(1, 2), 5), false);
    assert.equal(hasCandidate(state, cell(7, 8), 5), false);
    assert.equal(hasCandidate(state, cell(1, 4), 5), true);
  });

  test("Swordfish: a digit in the same three columns of three rows leaves the rest of the columns", ()=> {
    const state= emptyState();
    const keep= {0: [1, 4], 3: [4, 7], 6: [1, 7]};
    for (const [row, columns] of Object.entries(keep)){
      removeDigit(state, 7, [0, 1, 2, 3, 4, 5, 6, 7, 8].filter(x=> ! columns.includes(x)).map(x=> cell(x, Number(row))));
    }

    assert.equal(technique("Swordfish").apply(state), true);
    const eliminated= [1, 2, 4, 5, 7, 8].flatMap(y=> [1, 4, 7].map(x=> cell(x, y))).filter(index=> ! hasCandidate(state, index, 7));
    assert.ok(eliminated.length> 0);
    assert.equal(hasCandidate(state, cell(1, 0), 7), true);
  });

  test("XY-Wing: the shared digit of the wings leaves the cells seeing both", ()=> {
    const state= emptyState();
    state.candidates[cell(4, 4)]= mask(1, 2); // pivot
    state.candidates[cell(0, 4)]= mask(1, 3); // same row
    state.candidates[cell(4, 0)]= mask(2, 3); // same column

    assert.equal(technique("XY-Wing").apply(state), true);
    assert.equal(hasCandidate(state, cell(0, 0), 3), false);
    assert.equal(hasCandidate(state, cell(1, 1), 3), true);
  });

  test("XYZ-Wing: the shared digit leaves the cells seeing the pivot and both wings", ()=> {
    const state= emptyState();
    state.candidates[cell(4, 4)]= mask(1, 2, 3); // pivot
    state.candidates[cell(5, 4)]= mask(1, 3);
    state.candidates[cell(4, 3)]= mask(2, 3);

    assert.equal(technique("XYZ-Wing").apply(state), true);
    assert.equal(hasCandidate(state, cell(3, 3), 3), false);
    assert.equal(hasCandidate(state, cell(0, 4), 3), true);
  });
});

describe("solveLogically", ()=> {
  test("a full grid needs nothing", ()=> {
    const result= solveLogically(SOLUTION);
    assert.equal(result.solved, true);
    assert.equal(result.tier, 0);
  });

  test("one missing number is a single", ()=> {
    const puzzle= copy(SOLUTION);
    puzzle[4][4]= null;

    const result= solveLogically(puzzle);
    assert.equal(result.solved, true);
    assert.equal(result.tier, 1);
    assert.deepEqual(result.board, SOLUTION);
  });

  test("a puzzle with many solutions can't be solved by logic", ()=> {
    assert.equal(solveLogically(EMPTY).solved, false);
  });

  test("the techniques never contradict the real solution", ()=> {
    for (let i= 0; i<40; i++){
      const grid= new SudokuGrid();
      grid.generateLevel();
      const solution= grid.toArray().flat();
      grid.unsolve(56);

      const state= new SolverState(grid.toArray());
      while (! state.isSolved()){
        const used= TECHNIQUES.find(candidate=> candidate.apply(state));
        if (! used) break;

        for (let index= 0; index<81; index++){
          if (state.values[index]) assert.equal(state.values[index], solution[index], `${used.name} placed a wrong number`);
          else assert.ok(hasCandidate(state, index, solution[index]), `${used.name} removed the right number`);
        }
      }
    }
  });
});
