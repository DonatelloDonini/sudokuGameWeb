import Modal from "./Modal.js";
import { api } from "./api.js";
import { el, formatDuration } from "./utils.js";

const capitalize= (text)=> text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Builds a ranking table.
 *
 * @param {string[]} headers
 * @param {Array<{cells: (string|number)[], highlighted: boolean}>} rows
 */
const table= (headers, rows)=> el("table", {className: "leaderboard-table"},
  el("thead", {}, el("tr", {}, ...headers.map(header=> el("th", {scope: "col", text: header})))),
  el("tbody", {}, ...rows.map(({cells, highlighted})=> el("tr", {className: highlighted ? "current-user" : ""},
    ...cells.map(cell=> el("td", {text: String(cell)})),
  ))),
);

/**
 * The leaderboard dialog: battle elo ranking and best single player times per difficulty.
 */
export default class Leaderboard{
  /**
   * @param {string[]} difficulties
   * @param {Function} getUsername Returns the logged in username (highlighted in the tables), or null.
   */
  constructor(difficulties, getUsername){
    this.difficulties= difficulties;
    this.getUsername= getUsername;
    this.modal= new Modal("Leaderboard");
    this.tabs= [
      {id: "elo", label: "Battle elo"},
      ...difficulties.map(difficulty=> ({id: difficulty, label: capitalize(difficulty)})),
    ];
  }

  /**
   * @param {string} [tabId] Which ranking to open first.
   */
  show(tabId= "elo"){
    this.modal.show();
    this.#open(tabId);
  }

  async #open(tabId){
    const tabList= el("div", {className: "tabs", role: "tablist"}, ...this.tabs.map(tab=> el("button", {
      className: "tab",
      type: "button",
      role: "tab",
      "aria-selected": tab.id=== tabId ? "true" : "false",
      text: tab.label,
      onClick: ()=> this.#open(tab.id),
    })));
    const content= el("div", {className: "leaderboard-content", role: "tabpanel"}, el("p", {className: "muted", text: "Loading…"}));
    this.modal.setContent(tabList, content);

    try {
      content.replaceChildren(tabId=== "elo" ? await this.#eloTable() : await this.#timesTable(tabId));
    }
    catch (error) {
      content.replaceChildren(el("p", {className: "error-text", text: error.message}));
    }
  }

  async #eloTable(){
    const {players}= await api.eloLeaderboard();
    if (players.length=== 0) return el("p", {className: "muted", text: "No battles played yet. Be the first!"});

    const username= this.getUsername();
    return table(["#", "Player", "Elo", "W", "L"], players.map((player, i)=> ({
      cells: [i+1, player.username, player.elo, player.wins, player.losses],
      highlighted: player.username=== username,
    })));
  }

  async #timesTable(difficulty){
    const {players}= await api.timesLeaderboard(difficulty);
    if (players.length=== 0) return el("p", {className: "muted", text: `Nobody solved a ${difficulty} sudoku yet.`});

    const username= this.getUsername();
    return table(["#", "Player", "Best time", "Solved"], players.map((player, i)=> ({
      cells: [i+1, player.username, formatDuration(player.bestMs), player.completed],
      highlighted: player.username=== username,
    })));
  }
}
