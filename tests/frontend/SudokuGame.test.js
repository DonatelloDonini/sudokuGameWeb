import { test, describe } from "node:test";
import assert from "node:assert/strict";
import SudokuGame from "../../frontend/js/SudokuGame.js";

const SOLUTION= [
  [5, 3, 4, 6, 7, 8, 9, 1, 2],
  [6, 7, 2, 1, 9, 5, 3, 4, 8],
  [1, 9, 8, 3, 4, 2, 5, 6, 7],
  [8, 5, 9, 7, 6, 1, 4, 2, 3],
  [4, 2, 6, 8, 5, 3, 7, 9, 1],
  [7, 1, 3, 9, 2, 4, 8, 5, 6],
  [9, 6, 1, 5, 3, 7, 2, 8, 4],
  [2, 8, 7, 4, 1, 9, 6, 3, 5],
  [3, 4, 5, 2, 8, 6, 1, 7, 9],
];

/** The solution with the first row emptied: cells 0-8 are free, the rest are givens. */
const puzzle= ()=> SOLUTION.map((row, y)=> y=== 0 ? new Array(9).fill(null) : [...row]);

const changesOf= (game)=> {
  const changes= [];
  game.addEventListener("change", (event)=> changes.push(event.detail.changes));
  return changes;
};

describe("SudokuGame", ()=> {
  test("every cell has 20 peers: its row, column and box", ()=> {
    for (const peers of SudokuGame.PEERS){
      assert.equal(peers.length, 20);
      assert.equal(new Set(peers).size, 20);
    }
    assert.ok(SudokuGame.PEERS[0].includes(8), "same row");
    assert.ok(SudokuGame.PEERS[0].includes(72), "same column");
    assert.ok(SudokuGame.PEERS[0].includes(20), "same box");
    assert.ok(! SudokuGame.PEERS[0].includes(30));
  });

  test("the given numbers can't be changed", ()=> {
    const game= new SudokuGame(puzzle());
    const changes= changesOf(game);

    game.setValue(9, 1);
    game.erase(9);
    game.toggleNote(9, 1);

    assert.equal(game.values[9], 6);
    assert.deepEqual(changes, []);
    assert.equal(game.isLocked(9), true);
    assert.equal(game.isLocked(0), false);
  });

  test("placing a number reports the change", ()=> {
    const game= new SudokuGame(puzzle());
    const changes= changesOf(game);

    game.setValue(0, 5);
    game.setValue(0, 5);

    assert.equal(game.values[0], 5);
    assert.deepEqual(changes, [[{index: 0, value: 5}]], "placing the same number again does nothing");
  });

  test("numbers repeated in a row, column or box are conflicts", ()=> {
    const game= new SudokuGame(puzzle());
    game.setValue(0, 6); // 6 is already in the first column (row 2)

    assert.deepEqual([...game.conflicts()].sort((a, b)=> a - b), [0, 9]);
    game.setValue(0, 5);
    assert.equal(game.conflicts().size, 0);
  });

  test("notes go in empty cells only, and toggle", ()=> {
    const game= new SudokuGame(puzzle());

    game.toggleNote(0, 5);
    game.toggleNote(0, 7);
    assert.equal(game.hasNote(0, 5), true);
    assert.equal(game.hasNote(0, 7), true);

    game.toggleNote(0, 7);
    assert.equal(game.hasNote(0, 7), false);

    game.setValue(1, 3);
    game.toggleNote(1, 4);
    assert.equal(game.hasNote(1, 4), false, "a cell with a number takes no notes");
  });

  test("placing a number clears the cell's notes and removes the number from its peers' notes", ()=> {
    const game= new SudokuGame(puzzle());
    game.toggleNote(0, 5);
    game.toggleNote(0, 3);
    game.toggleNote(1, 5);
    game.toggleNote(8, 5);

    game.setValue(0, 5);

    assert.equal(game.notes[0], 0);
    assert.equal(game.hasNote(1, 5), false);
    assert.equal(game.hasNote(8, 5), false);
  });

  test("erase removes the number first, then the notes", ()=> {
    const game= new SudokuGame(puzzle());
    game.toggleNote(0, 2);
    game.setValue(1, 3);

    game.erase(1);
    assert.equal(game.values[1], null);

    game.erase(0);
    assert.equal(game.notes[0], 0);
  });

  test("undo restores numbers and notes, and reports which numbers changed", ()=> {
    const game= new SudokuGame(puzzle());
    game.toggleNote(1, 4);
    game.setValue(0, 5);
    game.setValue(1, 3);
    const changes= changesOf(game);

    game.undo();
    assert.equal(game.values[1], null);
    assert.equal(game.hasNote(1, 4), true);
    assert.deepEqual(changes.at(-1), [{index: 1, value: null}]);

    game.undo();
    game.undo();
    assert.equal(game.hasNote(1, 4), false);
    assert.equal(game.canUndo, false);
    game.undo(); // nothing left: no error
  });

  test("the history is limited", ()=> {
    const game= new SudokuGame(puzzle());
    for (let i= 0; i<SudokuGame.MAX_HISTORY + 20; i++) game.toggleNote(0, 1);
    assert.equal(game.history.length, SudokuGame.MAX_HISTORY);
  });

  test("remaining counts how many of each number are missing", ()=> {
    const game= new SudokuGame(puzzle());
    assert.equal(game.remaining(5), 1);
    game.setValue(0, 5);
    assert.equal(game.remaining(5), 0);
  });

  test("a filled board without conflicts is complete", ()=> {
    const game= new SudokuGame(puzzle());
    SOLUTION[0].forEach((value, x)=> game.setValue(x, value));

    assert.equal(game.isFilled(), true);
    assert.equal(game.isComplete(), true);
    assert.deepEqual(game.board(), SOLUTION);
  });

  test("a filled board with a conflict is not complete", ()=> {
    const game= new SudokuGame(puzzle());
    SOLUTION[0].forEach((value, x)=> game.setValue(x, value));
    game.setValue(0, 3);

    assert.equal(game.isFilled(), true);
    assert.equal(game.isComplete(), false);
  });

  test("a hint fills and locks a cell, and can't be undone", ()=> {
    const game= new SudokuGame(puzzle());
    game.toggleNote(1, 5);
    game.setValue(2, 4);

    game.applyHint(0, 5);

    assert.equal(game.values[0], 5);
    assert.equal(game.isLocked(0), true);
    assert.equal(game.hasNote(1, 5), false);
    assert.equal(game.canUndo, false);
    game.setValue(0, 1);
    assert.equal(game.values[0], 5);
  });

  test("revealing the solution marks the missed cells and ends the game", ()=> {
    const game= new SudokuGame(puzzle());
    game.setValue(0, 5);
    game.setValue(1, 9); // wrong
    const changes= changesOf(game);

    game.reveal(SOLUTION);

    assert.deepEqual(game.board(), SOLUTION);
    assert.equal(game.revealed.has(0), false, "a right number isn't marked");
    assert.equal(game.revealed.has(1), true, "a wrong number is");
    assert.equal(game.revealed.has(2), true, "an empty cell is");
    assert.equal(game.readOnly, true);
    assert.equal(changes[0].length, 8);

    game.setValue(2, 1);
    assert.equal(game.values[2], 4, "read only");
  });

  test("a game resumes from its saved state", ()=> {
    const game= new SudokuGame(puzzle());
    game.setValue(0, 5);
    game.toggleNote(1, 3);
    game.applyHint(2, 4);

    const saved= JSON.parse(JSON.stringify(game.toJSON()));
    const resumed= new SudokuGame(puzzle(), saved);

    assert.deepEqual(resumed.values, game.values);
    assert.deepEqual(resumed.notes, game.notes);
    assert.equal(resumed.isLocked(2), true);
    assert.equal(resumed.readOnly, false);
  });
});
