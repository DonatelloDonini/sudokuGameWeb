const path= require("node:path");
const {openDatabase}= require("./database");
const {Users}= require("./users");

const USAGE= `Usage: node src/cli.js <command> <username>

Commands:
  make-admin <username>     gives the user access to the admin dashboard
  remove-admin <username>   takes it back
  unban <username>          lets a banned user log in again

The database is DATABASE_PATH (default: backend/data/sudoku.db).
With Docker: docker compose exec sudoku node backend/src/cli.js make-admin <username>`;

const COMMANDS= {
  "make-admin": (users, user)=> {
    users.setAdmin(user.id, true);
    return `${user.username} is now an admin.`;
  },
  "remove-admin": (users, user)=> {
    users.setAdmin(user.id, false);
    return `${user.username} is not an admin anymore.`;
  },
  "unban": (users, user)=> {
    users.unban(user.id);
    return `${user.username} can log in again.`;
  },
};

/**
 * Runs a command.
 * @param {string[]} args The command line arguments, without "node" and the script.
 * @param {string} databasePath
 * @returns {{code: number, output: string}}
 */
const run= (args, databasePath)=> {
  const [command, username]= args;
  if (! Object.hasOwn(COMMANDS, command) || ! username) return {code: 1, output: USAGE};

  const db= openDatabase(databasePath);
  try {
    const users= new Users(db);
    const user= users.findByUsername(username);
    if (! user) return {code: 1, output: `No user called "${username}": they must register on the game first.`};

    return {code: 0, output: COMMANDS[command](users, user)};
  }
  finally {
    db.close();
  }
};

if (require.main=== module){
  const {code, output}= run(process.argv.slice(2), process.env.DATABASE_PATH || path.resolve(__dirname, "../data/sudoku.db"));
  (code=== 0 ? console.log : console.error)(output);
  process.exitCode= code;
}

module.exports= {run};
