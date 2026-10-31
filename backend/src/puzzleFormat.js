/**
 * Puzzle formats of the public API:
 * - "array": 9x9 array indexed as puzzle[y][x], empty cells are null (0 is also accepted as input);
 * - "string": 81 characters row by row, empty cells are "." ("0" is also accepted as input).
 */

const FORMATS= Object.freeze(["array", "string"]);

/**
 * Thrown when the client sends a puzzle that can't be read.
 */
class PuzzleFormatError extends Error{
  constructor(message){
    super(message);
    this.name= "PuzzleFormatError";
  }
}

/**
 * @param {*} input A puzzle in one of the formats, sent by a client.
 * @returns {(number|null)[][]} The puzzle as a 9x9 array with null for empty cells.
 * @throws {PuzzleFormatError}
 */
const parsePuzzle= (input)=> {
  if (typeof input=== "string"){
    const cells= input.replace(/\s/g, "");
    if (! /^[0-9.]{81}$/.test(cells)){
      throw new PuzzleFormatError("A puzzle string must have 81 characters: digits 1-9, and \".\" or \"0\" for empty cells.");
    }
    return Array.from({length: 9}, (_, y)=> [...cells.slice(y*9, y*9 + 9)].map(char=> (char=== "." || char=== "0") ? null : Number(char)));
  }

  const isValidArray= Array.isArray(input) && input.length=== 9 && input.every(row=> (
    Array.isArray(row) && row.length=== 9 && row.every(cell=> cell=== null || (Number.isInteger(cell) && cell>= 0 && cell<= 9))
  ));
  if (! isValidArray){
    throw new PuzzleFormatError("A puzzle must be a string of 81 characters or a 9x9 array of numbers 1-9, with null or 0 for empty cells.");
  }
  return input.map(row=> row.map(cell=> cell || null));
};

/**
 * @param {(number|null)[][]} board
 * @param {"array"|"string"} format
 * @returns {(number|null)[][]|string}
 */
const formatPuzzle= (board, format)=> format=== "string"
  ? board.flat().map(cell=> cell ?? ".").join("")
  : board;

/**
 * @param {(number|null)[][]} puzzle
 * @returns {boolean} Whether a number is repeated in a row, column or box.
 */
const breaksRules= (puzzle)=> {
  const seen= new Set();
  for (let y= 0; y<9; y++){
    for (let x= 0; x<9; x++){
      const value= puzzle[y][x];
      if (value=== null) continue;

      const box= Math.floor(y/3)*3 + Math.floor(x/3);
      for (const key of [`r${y}:${value}`, `c${x}:${value}`, `b${box}:${value}`]){
        if (seen.has(key)) return true;
        seen.add(key);
      }
    }
  }
  return false;
};

module.exports= {FORMATS, PuzzleFormatError, parsePuzzle, formatPuzzle, breaksRules};
