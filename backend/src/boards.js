/**
 * Helpers for the 9x9 boards exchanged with the client (indexed as board[y][x], empty cells are null).
 */

/**
 * @param {*} board Untrusted input.
 * @returns {boolean} Whether it is a 9x9 array of digits 1-9 or null.
 */
const isValidBoard= (board)=> (
  Array.isArray(board) &&
  board.length=== 9 &&
  board.every(row=> (
    Array.isArray(row) &&
    row.length=== 9 &&
    row.every(cell=> cell=== null || (Number.isInteger(cell) && cell>= 1 && cell<= 9))
  ))
);

/**
 * @returns {boolean} Whether the board keeps every given number of the puzzle.
 */
const respectsPuzzle= (board, puzzle)=> puzzle.every((row, y)=> row.every((given, x)=> given=== null || board[y][x]=== given));

const boardsEqual= (a, b)=> a.every((row, y)=> row.every((cell, x)=> cell=== b[y][x]));

const countEmpty= (board)=> board.flat().filter(cell=> cell=== null).length;

const copyBoard= (board)=> board.map(row=> [...row]);

module.exports= {isValidBoard, respectsPuzzle, boardsEqual, countEmpty, copyBoard};
