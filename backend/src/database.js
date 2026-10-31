const fs= require("node:fs");
const path= require("node:path");
const {DatabaseSync}= require("node:sqlite");

const SCHEMA= `
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT    NOT NULL,
    elo           INTEGER NOT NULL DEFAULT 1200,
    created_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT    PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );

  -- single player games; user_id is null for guests
  CREATE TABLE IF NOT EXISTS games (
    id          TEXT    PRIMARY KEY,
    user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    difficulty  TEXT    NOT NULL,
    puzzle      TEXT    NOT NULL,
    solution    TEXT    NOT NULL,
    status      TEXT    NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'revealed')),
    hints_used  INTEGER NOT NULL DEFAULT 0,
    started_at  INTEGER NOT NULL,
    finished_at INTEGER,
    duration_ms INTEGER
  );
  CREATE INDEX IF NOT EXISTS games_by_leaderboard ON games(difficulty, status, duration_ms);
  CREATE INDEX IF NOT EXISTS games_by_user ON games(user_id);

  CREATE TABLE IF NOT EXISTS battles (
    id                 TEXT    PRIMARY KEY,
    difficulty         TEXT    NOT NULL,
    puzzle             TEXT    NOT NULL,
    solution           TEXT    NOT NULL,
    player1_id         INTEGER NOT NULL REFERENCES users(id),
    player2_id         INTEGER NOT NULL REFERENCES users(id),
    player1_elo_before INTEGER NOT NULL,
    player2_elo_before INTEGER NOT NULL,
    winner_id          INTEGER NOT NULL REFERENCES users(id),
    elo_change         INTEGER NOT NULL,
    end_reason         TEXT    NOT NULL CHECK (end_reason IN ('solved', 'resign', 'disconnect')),
    started_at         INTEGER NOT NULL,
    finished_at        INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS battles_by_player1 ON battles(player1_id);
  CREATE INDEX IF NOT EXISTS battles_by_player2 ON battles(player2_id);
`;

/**
 * Columns added after the first version: [table, column, definition].
 * They are added to existing databases when the server starts.
 */
const ADDED_COLUMNS= [
  // the hardest technique the level needs (see HumanSolver) and its difficulty score
  ["games", "hardest_technique", "TEXT"],
  ["games", "score", "INTEGER"],
  ["battles", "hardest_technique", "TEXT"],
];

const addMissingColumns= (db)=> {
  for (const [table, column, definition] of ADDED_COLUMNS){
    const exists= db.prepare(`PRAGMA table_info(${table})`).all().some(info=> info.name=== column);
    if (! exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
};

/**
 * Opens (creating it if needed) the SQLite database and makes sure the schema exists.
 * @param {string} filename The database file, or ":memory:" for a throwaway database.
 * @returns {DatabaseSync}
 */
const openDatabase= (filename)=> {
  if (filename!== ":memory:") fs.mkdirSync(path.dirname(filename), {recursive: true});

  const db= new DatabaseSync(filename);
  db.exec("PRAGMA foreign_keys = ON;");
  if (filename!== ":memory:") db.exec("PRAGMA journal_mode = WAL;");
  db.exec(SCHEMA);
  addMissingColumns(db);

  return db;
};

/**
 * Runs a function inside a transaction, rolling back if it throws.
 * @param {DatabaseSync} db
 * @param {Function} fn
 * @returns {*} What fn returns.
 */
const transaction= (db, fn)=> {
  db.exec("BEGIN");
  try {
    const result= fn();
    db.exec("COMMIT");
    return result;
  }
  catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
};

module.exports= {openDatabase, transaction};
