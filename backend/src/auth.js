const crypto= require("node:crypto");
const util= require("node:util");

const SESSION_COOKIE= "sudoku_session";
const SESSION_DURATION_MS= 30 * 24 * 60 * 60 * 1000;
const SCRYPT_KEY_LENGTH= 64;

const scrypt= util.promisify(crypto.scrypt);

/**
 * @param {string} password
 * @returns {Promise<string>} "salt:hash", both hex encoded.
 */
const hashPassword= async (password)=> {
  const salt= crypto.randomBytes(16);
  const hash= await scrypt(password, salt, SCRYPT_KEY_LENGTH);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
};

/**
 * @param {string} password
 * @param {string} storedHash A value returned by hashPassword.
 * @returns {Promise<boolean>}
 */
const verifyPassword= async (password, storedHash)=> {
  const [saltHex, hashHex]= storedHash.split(":");
  const expected= Buffer.from(hashHex, "hex");
  const actual= await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
  return crypto.timingSafeEqual(expected, actual);
};

/** Only the hash of a session token is stored, so a leaked database can't be used to log in. */
const hashToken= (token)=> crypto.createHash("sha256").update(token).digest("hex");

/**
 * @param {string|undefined} header The Cookie request header.
 * @returns {Object<string, string>}
 */
const parseCookies= (header= "")=> {
  const cookies= {};
  for (const part of header.split(";")){
    const separatorIndex= part.indexOf("=");
    if (separatorIndex=== -1) continue;

    const name= part.slice(0, separatorIndex).trim();
    const value= part.slice(separatorIndex+1).trim();
    try {
      cookies[name]= decodeURIComponent(value);
    }
    catch {
      cookies[name]= value;
    }
  }
  return cookies;
};

/**
 * Session management: tokens live in an httpOnly cookie, their hashes in the sessions table.
 */
class Sessions{
  /**
   * @param {import("node:sqlite").DatabaseSync} db
   * @param {import("./users").Users} users
   * @param {Object} options
   * @param {boolean} options.secureCookies Whether to mark the cookie as Secure (needs HTTPS).
   */
  constructor(db, users, {secureCookies= false}= {}){
    this.db= db;
    this.users= users;
    this.secureCookies= secureCookies;
  }

  /**
   * @param {number} userId
   * @returns {string} The session token to give to the client.
   */
  create(userId){
    const token= crypto.randomBytes(32).toString("base64url");
    this.db
      .prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
      .run(hashToken(token), userId, Date.now() + SESSION_DURATION_MS);
    return token;
  }

  destroy(token){
    this.db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
  }

  deleteExpired(){
    this.db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now());
  }

  /**
   * @param {string|undefined} token
   * @returns {Object|null} The users row the token belongs to, if the session is still valid and the user isn't banned.
   */
  findUser(token){
    if (! token) return null;

    const session= this.db
      .prepare("SELECT user_id, expires_at FROM sessions WHERE token_hash = ?")
      .get(hashToken(token));
    if (! session || session.expires_at< Date.now()) return null;

    const user= this.users.findById(session.user_id);
    return user && user.banned_at=== null ? user : null;
  }

  /**
   * @param {import("node:http").IncomingMessage} req
   * @returns {Object|null} The logged in user, if any.
   */
  userFromRequest(req){
    return this.findUser(parseCookies(req.headers.cookie)[SESSION_COOKIE]);
  }

  setCookie(res, token){
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: this.secureCookies,
      maxAge: SESSION_DURATION_MS,
      path: "/",
    });
  }

  clearCookie(res){
    res.clearCookie(SESSION_COOKIE, {path: "/"});
  }

  /**
   * Express middleware setting req.sessionToken and req.user (null for guests).
   */
  middleware(){
    return (req, res, next)=> {
      req.sessionToken= parseCookies(req.headers.cookie)[SESSION_COOKIE];
      req.user= this.findUser(req.sessionToken);
      next();
    };
  }
}

module.exports= {Sessions, hashPassword, verifyPassword, parseCookies, SESSION_COOKIE};
