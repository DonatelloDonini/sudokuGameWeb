/** How much a single battle can move the ratings. */
const K_FACTOR= 32;

/**
 * @param {number} playerElo
 * @param {number} opponentElo
 * @returns {number} The probability (0-1) of the player beating the opponent.
 */
const expectedScore= (playerElo, opponentElo)=> 1 / (1 + 10 ** ((opponentElo - playerElo) / 400));

/**
 * @param {number} winnerElo
 * @param {number} loserElo
 * @returns {number} The points the winner gains and the loser loses (at least 1).
 */
const eloChange= (winnerElo, loserElo)=> Math.max(1, Math.round(K_FACTOR * (1 - expectedScore(winnerElo, loserElo))));

/**
 * The battle level gets harder as the players get better.
 * @param {number} averageElo
 * @returns {string} A difficulty name.
 */
const difficultyForElo= (averageElo)=> {
  if (averageElo< 1100) return "easy";
  if (averageElo< 1300) return "medium";
  if (averageElo< 1500) return "hard";
  return "expert";
};

module.exports= {K_FACTOR, expectedScore, eloChange, difficultyForElo};
