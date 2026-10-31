/**
 * Error thrown when the server answers with an error status.
 */
export class ApiError extends Error{
  constructor(status, message){
    super(message);
    this.name= "ApiError";
    this.status= status;
  }
}

/**
 * Calls the backend API.
 *
 * @param {string} path The path after /api.
 * @param {Object} [body] Sent as JSON with a POST request; without it the request is a GET.
 *
 * @returns {Promise<Object>} The JSON answer.
 * @throws {ApiError}
 */
export const request= async (path, body)=> {
  const options= body=== undefined ? {} : {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(body),
  };

  let response;
  try {
    response= await fetch(`/api${path}`, {credentials: "same-origin", ...options});
  }
  catch {
    throw new ApiError(0, "Can't reach the server, check your connection.");
  }

  const data= await response.json().catch(()=> ({}));
  if (! response.ok) throw new ApiError(response.status, data.error ?? `Request failed (HTTP ${response.status}).`);

  return data;
};

export const api= {
  me: ()=> request("/auth/me"),
  register: (username, password)=> request("/auth/register", {username, password}),
  login: (username, password)=> request("/auth/login", {username, password}),
  logout: ()=> request("/auth/logout", {}),
  setAvatar: (avatar)=> request("/auth/avatar", {avatar}),

  newGame: (difficulty)=> request("/games", {difficulty}),
  hint: (gameId, board)=> request(`/games/${gameId}/hint`, {board}),
  solution: (gameId)=> request(`/games/${gameId}/solution`, {}),
  complete: (gameId, board)=> request(`/games/${gameId}/complete`, {board}),

  eloLeaderboard: ()=> request("/leaderboard/elo"),
  timesLeaderboard: (difficulty)=> request(`/leaderboard/times/${difficulty}`),

  reportReasons: ()=> request("/reports/reasons"),
  report: ({username, battleId= null, reason, comment= ""})=> request("/reports", {username, battleId, reason, comment}),
};
