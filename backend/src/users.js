const {avatarCodeOf}= require("./avatars");

const STARTING_ELO= 1200;

/**
 * Data access for the users table.
 */
class Users{
  /**
   * @param {import("node:sqlite").DatabaseSync} db
   */
  constructor(db){
    this.db= db;
  }

  /**
   * @param {string} username
   * @param {string} passwordHash
   * @returns {Object} The new user row.
   */
  create(username, passwordHash){
    const {lastInsertRowid}= this.db
      .prepare("INSERT INTO users (username, password_hash, elo, created_at) VALUES (?, ?, ?, ?)")
      .run(username, passwordHash, STARTING_ELO, Date.now());

    return this.findById(Number(lastInsertRowid));
  }

  findById(id){
    return this.db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  }

  /** Usernames are case insensitive. */
  findByUsername(username){
    return this.db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  }

  setElo(id, elo){
    this.db.prepare("UPDATE users SET elo = ? WHERE id = ?").run(elo, id);
  }

  /**
   * @param {number} id
   * @param {string} code A valid avatar code.
   */
  setAvatar(id, code){
    this.db.prepare("UPDATE users SET avatar = ? WHERE id = ?").run(code, id);
  }

  setAdmin(id, isAdmin){
    this.db.prepare("UPDATE users SET is_admin = ? WHERE id = ?").run(isAdmin ? 1 : 0, id);
  }

  /**
   * Bans a user: they are logged out everywhere and can't log in, and they leave the leaderboards.
   */
  ban(id, reason){
    this.db.prepare("UPDATE users SET banned_at = ?, ban_reason = ? WHERE id = ?").run(Date.now(), reason, id);
    this.db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
  }

  unban(id){
    this.db.prepare("UPDATE users SET banned_at = NULL, ban_reason = NULL WHERE id = ?").run(id);
  }

  /**
   * The user as shown to the client, with battle and single player stats.
   * @param {Object} user A users row.
   * @returns {Object}
   */
  toPublic(user){
    const battles= this.db.prepare(`
      SELECT
        COUNT(*)                                     AS played,
        COALESCE(SUM(winner_id = $id), 0)            AS wins
      FROM battles
      WHERE player1_id = $id OR player2_id = $id
    `).get({$id: user.id});

    const {gamesCompleted}= this.db
      .prepare("SELECT COUNT(*) AS gamesCompleted FROM games WHERE user_id = ? AND status = 'completed'")
      .get(user.id);

    return {
      id: user.id,
      username: user.username,
      avatar: avatarCodeOf(user),
      elo: user.elo,
      battlesPlayed: battles.played,
      battlesWon: battles.wins,
      battlesLost: battles.played - battles.wins,
      gamesCompleted,
      isAdmin: user.is_admin=== 1,
    };
  }
}

module.exports= {Users, STARTING_ELO};
