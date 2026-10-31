/**
 * What the server does for a solo game, done on the device for the offline games (their solution is on the device).
 */

/**
 * Picks the cell a hint fills: a wrong number if the player made a mistake, an empty cell otherwise.
 * @param {(number|null)[][]} board
 * @param {number[][]} solution
 * @param {Function} [random]
 * @returns {{x: number, y: number, value: number}|null} null when the board is solved.
 */
export const localHint= (board, solution, random= Math.random)=> {
  const wrong= [];
  const empty= [];
  board.forEach((row, y)=> row.forEach((value, x)=> {
    if (value=== null) empty.push({x, y});
    else if (value!== solution[y][x]) wrong.push({x, y});
  }));

  const candidates= wrong.length> 0 ? wrong : empty;
  if (candidates.length=== 0) return null;

  const {x, y}= candidates[Math.floor(random() * candidates.length)];
  return {x, y, value: solution[y][x]};
};

/**
 * @returns {boolean} Whether the board is the solution.
 */
export const isSolved= (board, solution)=> board.every((row, y)=> row.every((value, x)=> value=== solution[y][x]));
