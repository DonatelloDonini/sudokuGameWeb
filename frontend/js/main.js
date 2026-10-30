import SudokuGame from "./SudokuGame.js";
import SudokuBoard from "./SudokuBoard.js";
import BattleClient from "./BattleClient.js";
import Leaderboard from "./Leaderboard.js";
import AccountDialog from "./AccountDialog.js";
import RulesButton from "./RulesButton.js";
import Modal from "./Modal.js";
import { api, ApiError } from "./api.js";
import { applyRandomPalette } from "./Palette.js";
import { el, icon, ICONS, formatDuration, loadFromStorage, saveToStorage } from "./utils.js";

const DIFFICULTIES= ["easy", "medium", "hard", "expert"];
const DEFAULT_DIFFICULTY= "medium";
const HINT_PENALTY_MS= 30 * 1000;

const STORAGE_KEYS= Object.freeze({
  soloGame: "sudoku-solo-game",
  difficulty: "sudoku-difficulty",
  mode: "sudoku-mode",
});

/**
 * Rules shown inside the rules panel, one entry per section.
 *
 * @type {import("./RulesButton.js").RulesSection[]}
 */
const RULES= [
  {
    title: "Goal",
    items: [
      "Fill every empty cell with a number from 1 to 9.",
      "Each row, each column and each 3x3 box must contain every number from 1 to 9 exactly once.",
      "Every puzzle has a single solution: you never need to guess.",
    ],
  },
  {
    title: "Controls",
    items: [
      "Click or tap a cell to select it, then pick a number on the number pad or type it on the keyboard.",
      "Arrow keys move the selection. Backspace, Delete or 0 erase the cell. Ctrl+Z (or U) undoes the last move.",
      "Numbers that break a rule are shown in red. The small counter on each number pad key tells how many of that number are still missing.",
    ],
  },
  {
    title: "Pencil mode",
    items: [
      "Turn on the pencil (or press N) to write small notes with the numbers a cell could hold.",
      "Pressing a number again removes the note. Hold Shift while typing a number to write a note without turning the pencil on.",
      "When you place a number, it is removed from the notes of its row, column and box.",
    ],
  },
  {
    title: "Hints and solution",
    items: [
      "A hint fixes one of your mistakes, or fills an empty cell if you made none. Each hint adds 30 seconds to your time.",
      "The solution button shows the whole solution and ends the game: it won't count for the leaderboard.",
    ],
  },
  {
    title: "Leaderboard",
    items: [
      "Log in to have your solo times saved: the leaderboard keeps the best time of each player on every difficulty.",
      "The time is measured by the server from the moment the game starts.",
    ],
  },
  {
    title: "Battle",
    items: [
      "Battles pit you against a player with your elo (everyone starts at 1200). If nobody with your exact elo is around, the search slowly widens.",
      "Both players get the same puzzle at the same time: the first one to solve it wins. You can see how many cells your opponent has filled, not which ones.",
      "The winner takes elo points from the loser: more when beating a stronger player. Better players get harder puzzles.",
      "Resigning or staying disconnected for more than 20 seconds loses the battle. Hints and the solution are not available.",
    ],
  },
];

const capitalize= (text)=> text.charAt(0).toUpperCase() + text.slice(1);

/**
 * The whole page: solo games, battles, account and leaderboard.
 */
class App{
  constructor(){
    /** @type {Object|null} The logged in user. */
    this.user= null;
    /** @type {"solo"|"battle"} */
    this.mode= "solo";
    /** @type {number|null} */
    this.selectedIndex= null;
    this.pencil= false;

    /**
     * The solo game, null until it is loaded.
     * @type {{id: string, difficulty: string, puzzle: number[][], startedAt: number, hintsUsed: number, ownerId: number|null,
     *         status: "playing"|"won"|"revealed", durationMs: number|null, game: SudokuGame}|null}
     */
    this.solo= null;
    this.soloBusy= false;

    /**
     * The battle state. `phase` is idle, queue, countdown, playing or over.
     */
    this.battle= {phase: "idle", game: null, connected: false};
    this.battleClient= new BattleClient();

    /** Shown in battle mode while there is no battle. */
    this.placeholderGame= new SudokuGame(Array.from({length: 9}, ()=> new Array(9).fill(null)), {readOnly: true});

    this.board= new SudokuBoard();
    this.leaderboard= new Leaderboard(DIFFICULTIES, ()=> this.user?.username ?? null);
    this.accountDialog= new AccountDialog({
      getUser: ()=> this.user,
      onUserChange: (user)=> this.setUser(user),
    });
  }

  async start(){
    this.#buildPage();
    this.#listenToBattleServer();
    document.addEventListener("keydown", (event)=> this.#onKeyDown(event));
    setInterval(()=> this.#tick(), 250);

    try {
      this.user= (await api.me()).user;
    }
    catch {
      this.user= null;
    }
    this.#renderAccountButton();

    await this.#loadSoloGame();
    this.setMode(loadFromStorage(STORAGE_KEYS.mode, "solo")=== "battle" ? "battle" : "solo");
  }

  //////      //////
  ////// page //////
  //////      //////

  #buildPage(){
    const headerActions= document.getElementById("header-actions");

    this.leaderboardButton= el("button", {className: "round-button", type: "button", title: "Leaderboard", "aria-label": "Show the leaderboard", onClick: ()=> this.leaderboard.show(this.mode=== "solo" ? this.solo?.difficulty : "elo")}, icon(ICONS.trophy));
    this.accountButton= el("button", {className: "account-button", type: "button", onClick: ()=> this.#openAccount()});
    headerActions.append(this.leaderboardButton, this.accountButton, new RulesButton(RULES).DOMElement);

    this.soloTab= el("button", {className: "tab", type: "button", role: "tab", text: "Solo", onClick: ()=> this.setMode("solo")});
    this.battleTab= el("button", {className: "tab", type: "button", role: "tab", text: "Battle", onClick: ()=> this.setMode("battle")});
    document.getElementById("mode-tabs").append(this.soloTab, this.battleTab);

    this.statusBar= document.getElementById("status-bar");
    document.getElementById("board-area").appendChild(this.board.DOMElement);
    this.board.addEventListener("select", (event)=> this.select(event.detail.index));

    this.controls= {
      undo: this.#controlButton("Undo", ICONS.undo, ()=> this.currentGame()?.undo()),
      erase: this.#controlButton("Erase", ICONS.eraser, ()=> this.erase()),
      pencil: this.#controlButton("Pencil", ICONS.pencil, ()=> this.togglePencil()),
      hint: this.#controlButton("Hint", ICONS.lightbulb, ()=> this.hint()),
      solution: this.#controlButton("Solution", ICONS.eye, ()=> this.showSolution()),
    };
    document.getElementById("controls").append(...Object.values(this.controls));

    this.numberKeys= Array.from({length: 9}, (_, i)=> {
      const digit= i+1;
      const count= el("span", {className: "number-count"});
      const key= el("button", {className: "number-key", type: "button", "aria-label": `Number ${digit}`, onClick: ()=> this.input(digit)},
        el("span", {className: "number-digit", text: String(digit)}),
        count,
      );
      key.count= count;
      return key;
    });
    document.getElementById("number-pad").append(...this.numberKeys);

    this.message= document.getElementById("message");
  }

  #controlButton(label, iconPath, onClick){
    return el("button", {className: "control-button", type: "button", onClick}, icon(iconPath), el("span", {text: label}));
  }

  #renderAccountButton(){
    this.accountButton.replaceChildren(
      icon(ICONS.user),
      el("span", {className: "account-label", text: this.user ? `${this.user.username} · ${this.user.elo}` : "Log in"}),
    );
    this.accountButton.setAttribute("aria-label", this.user ? `Account of ${this.user.username}` : "Log in or register");
  }

  async #openAccount(){
    if (this.user){
      try {
        this.user= (await api.me()).user;
        this.#renderAccountButton();
      }
      catch {}
    }
    this.accountDialog.show();
  }

  /**
   * @param {string} text
   * @param {"info"|"error"|"success"} [kind]
   */
  showMessage(text, kind= "info"){
    this.message.textContent= text;
    this.message.dataset.kind= kind;
  }

  //////       //////
  ////// state //////
  //////       //////

  currentGame(){
    if (this.mode=== "solo") return this.solo?.game ?? null;
    return this.battle.game ?? this.placeholderGame;
  }

  /**
   * @returns {boolean} Whether the player can change the board right now.
   */
  canPlay(){
    if (this.mode=== "solo") return this.solo?.status=== "playing" && ! this.soloBusy;
    return this.battle.phase=== "playing";
  }

  setMode(mode){
    const battleRunning= ["countdown", "playing"].includes(this.battle.phase);
    if (mode=== "solo" && battleRunning){
      this.showMessage("Finish or resign the battle first.", "error");
      return;
    }

    if (mode=== "solo" && this.battle.phase=== "queue") this.leaveQueue();

    this.mode= mode;
    this.selectedIndex= null;
    saveToStorage(STORAGE_KEYS.mode, mode);
    this.showMessage("");

    if (mode=== "battle" && this.user) this.battleClient.connect();

    this.render();
  }

  async setUser(user){
    const previousUserId= this.user?.id ?? null;
    this.user= user;
    this.#renderAccountButton();

    if (! user){
      this.battleClient.disconnect();
      this.battle= {phase: "idle", game: null, connected: false};
    }
    else if (this.mode=== "battle"){
      this.battleClient.connect();
    }

    // a ranked game belongs to its player: start over when someone else is now playing
    const soloOwner= this.solo?.ownerId ?? null;
    if (soloOwner!== null && soloOwner!== (user?.id ?? null)){
      await this.newSoloGame(this.solo.difficulty);
    }
    else if (user && previousUserId=== null && this.solo?.status=== "playing"){
      this.showMessage("This game was started as a guest and won't be ranked: start a new game to get on the leaderboard.");
    }

    this.render();
  }

  select(index){
    this.selectedIndex= index;
    this.render();
  }

  input(digit, asNote= false){
    const game= this.currentGame();
    if (! this.canPlay() || this.selectedIndex=== null) return;

    if (this.pencil || asNote){
      game.toggleNote(this.selectedIndex, digit);
    }
    else{
      game.setValue(this.selectedIndex, game.values[this.selectedIndex]=== digit ? null : digit);
    }
  }

  erase(){
    if (! this.canPlay() || this.selectedIndex=== null) return;
    this.currentGame().erase(this.selectedIndex);
  }

  togglePencil(){
    this.pencil= ! this.pencil;
    this.render();
  }

  #moveSelection(dx, dy){
    if (this.selectedIndex=== null){
      this.select(0);
      return;
    }
    const x= (this.selectedIndex % 9 + dx + 9) % 9;
    const y= (Math.floor(this.selectedIndex / 9) + dy + 9) % 9;
    this.select(y*9 + x);
  }

  #onKeyDown(event){
    if (Modal.anyOpen) return;
    if (event.target.closest?.("input, select, textarea")) return;

    const key= event.key;
    const digit= /^Digit[1-9]$|^Numpad[1-9]$/.test(event.code) ? Number(event.code.at(-1)) : null;
    const handled= ()=> event.preventDefault();

    if ((event.ctrlKey || event.metaKey) && key.toLowerCase()=== "z"){
      handled();
      this.currentGame()?.undo();
    }
    else if (event.ctrlKey || event.metaKey || event.altKey){
      return;
    }
    else if (digit!== null){
      handled();
      this.input(digit, event.shiftKey);
    }
    else if (["Backspace", "Delete", "0"].includes(key)){
      handled();
      this.erase();
    }
    else if (key.startsWith("Arrow")){
      handled();
      const moves= {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]};
      this.#moveSelection(...moves[key]);
    }
    else if (key.toLowerCase()=== "n" || key.toLowerCase()=== "p"){
      handled();
      this.togglePencil();
    }
    else if (key.toLowerCase()=== "u"){
      handled();
      this.currentGame()?.undo();
    }
    else if (key=== "Escape"){
      this.select(null);
    }
  }

  //////      //////
  ////// solo //////
  //////      //////

  async #loadSoloGame(){
    const saved= loadFromStorage(STORAGE_KEYS.soloGame);
    const savedIsUsable= saved?.id && saved.puzzle && (saved.ownerId=== null || saved.ownerId=== this.user?.id);

    if (savedIsUsable){
      this.#setSoloGame(saved, new SudokuGame(saved.puzzle, saved.state));
    }
    else{
      await this.newSoloGame(loadFromStorage(STORAGE_KEYS.difficulty, DEFAULT_DIFFICULTY));
    }
  }

  async newSoloGame(difficulty= this.solo?.difficulty ?? DEFAULT_DIFFICULTY){
    if (! DIFFICULTIES.includes(difficulty)) difficulty= DEFAULT_DIFFICULTY;
    saveToStorage(STORAGE_KEYS.difficulty, difficulty);

    this.soloBusy= true;
    this.showMessage("Generating a new puzzle…");
    try {
      const created= await api.newGame(difficulty);
      this.#setSoloGame({
        id: created.id,
        difficulty: created.difficulty,
        puzzle: created.puzzle,
        startedAt: created.startedAt,
        hintsUsed: 0,
        ownerId: created.ranked ? this.user.id : null,
        status: "playing",
        durationMs: null,
      }, new SudokuGame(created.puzzle));
      this.showMessage(created.ranked ? "" : "Playing as a guest: log in to get your times on the leaderboard.");
    }
    catch (error) {
      this.showMessage(error.message, "error");
    }
    finally {
      this.soloBusy= false;
      this.render();
    }
  }

  #setSoloGame(info, game){
    this.solo= {...info, game};
    this.selectedIndex= null;
    game.addEventListener("change", ()=> {
      this.#saveSoloGame();
      this.render();
      if (this.solo.game=== game && this.solo.status=== "playing" && game.isComplete()) this.#completeSoloGame();
    });
    this.#saveSoloGame();
    this.render();
  }

  #saveSoloGame(){
    if (! this.solo) return;
    const {game, ...info}= this.solo;
    saveToStorage(STORAGE_KEYS.soloGame, {...info, state: game.toJSON()});
  }

  /**
   * Handles the errors of the solo game requests; a game the server doesn't know anymore can't go on.
   */
  #soloRequestFailed(error){
    if (error instanceof ApiError && [403, 404, 409].includes(error.status)){
      this.solo.status= "revealed";
      this.solo.game.readOnly= true;
      this.#saveSoloGame();
      this.showMessage(`${error.message} Start a new game to keep playing.`, "error");
    }
    else{
      this.showMessage(error.message, "error");
    }
    this.render();
  }

  async #completeSoloGame(){
    const solo= this.solo;
    this.soloBusy= true;
    try {
      const result= await api.complete(solo.id, solo.game.board());
      if (! result.solved){
        this.showMessage("Every cell is filled but something is wrong: try a hint.", "error");
        return;
      }

      solo.status= "won";
      solo.durationMs= result.durationMs;
      solo.game.readOnly= true;
      this.#saveSoloGame();
      this.showMessage(`Solved in ${formatDuration(result.durationMs)}!`, "success");
      this.#showVictory(result);
    }
    catch (error) {
      this.#soloRequestFailed(error);
    }
    finally {
      this.soloBusy= false;
      this.render();
    }
  }

  #showVictory(result){
    const modal= new Modal("Solved!");
    const penalty= result.hintsUsed> 0 ? ` (including ${result.hintsUsed} hint${result.hintsUsed> 1 ? "s" : ""}, +${formatDuration(result.hintsUsed * HINT_PENALTY_MS)})` : "";

    modal.setContent(
      el("p", {className: "big-number", text: formatDuration(result.durationMs)}),
      el("p", {text: `${capitalize(this.solo.difficulty)} sudoku solved${penalty}.`}),
      el("p", {className: "muted", text: result.ranked
        ? `You are #${result.rank} on the ${this.solo.difficulty} leaderboard.`
        : "Log in before starting a game to get on the leaderboard."}),
      el("div", {className: "modal-actions"},
        el("button", {className: "button", type: "button", text: "Leaderboard", onClick: ()=> {
          modal.hide();
          this.leaderboard.show(this.solo.difficulty);
        }}),
        el("button", {className: "button button-primary", type: "button", text: "New game", onClick: ()=> {
          modal.hide();
          this.newSoloGame();
        }}),
      ),
    );
    modal.show();
  }

  async hint(){
    if (this.mode!== "solo" || ! this.canPlay()) return;

    const solo= this.solo;
    this.soloBusy= true;
    try {
      const {x, y, value, hintsUsed}= await api.hint(solo.id, solo.game.board());
      solo.hintsUsed= hintsUsed;
      this.selectedIndex= y*9 + x;
      this.showMessage(`Hint: row ${y+1}, column ${x+1} is a ${value} (+30 s).`);
      this.soloBusy= false;
      solo.game.applyHint(y*9 + x, value);
    }
    catch (error) {
      this.#soloRequestFailed(error);
    }
    finally {
      this.soloBusy= false;
      this.render();
    }
  }

  async showSolution(){
    if (this.mode!== "solo" || ! this.canPlay()) return;

    const confirmed= await Modal.confirm("Show the solution?", "The game will end and won't count for the leaderboard.", "Show solution");
    if (! confirmed) return;

    const solo= this.solo;
    this.soloBusy= true;
    try {
      const {solution}= await api.solution(solo.id);
      solo.status= "revealed";
      solo.game.reveal(solution);
      this.showMessage("Here is the solution: the cells you missed are highlighted.");
    }
    catch (error) {
      this.#soloRequestFailed(error);
    }
    finally {
      this.soloBusy= false;
      this.#saveSoloGame();
      this.render();
    }
  }

  //////        //////
  ////// battle //////
  //////        //////

  joinQueue(){
    if (! this.user){
      this.accountDialog.show();
      return;
    }
    this.battleClient.connect();
    if (! this.battleClient.send({type: "join-queue"})){
      this.showMessage("Connecting to the battle server…");
      this.battle.joinWhenConnected= true;
    }
  }

  leaveQueue(){
    this.battleClient.send({type: "leave-queue"});
    this.battle= {...this.battle, phase: "idle", joinWhenConnected: false};
    this.render();
  }

  async resign(){
    const confirmed= await Modal.confirm("Resign?", "You will lose the battle and its elo points.", "Resign");
    if (confirmed) this.battleClient.send({type: "resign"});
  }

  #listenToBattleServer(){
    const on= (type, handler)=> this.battleClient.addEventListener(type, (event)=> {
      handler(event.detail);
      this.render();
    });

    on("open", ()=> {
      this.battle.connected= true;
      if (this.battle.joinWhenConnected){
        this.battle.joinWhenConnected= false;
        this.battleClient.send({type: "join-queue"});
      }
    });

    on("close", ()=> {
      this.battle.connected= false;
      if (this.battle.phase=== "queue") this.battle.phase= "idle";
      if (["countdown", "playing"].includes(this.battle.phase)) this.showMessage("Connection lost, reconnecting…", "error");
    });

    on("welcome", ({elo})=> {
      if (this.user) this.user.elo= elo;
      this.#renderAccountButton();
    });

    on("queue-joined", ({elo})=> {
      this.battle= {...this.battle, phase: "queue", queueSince: Date.now(), elo};
      this.showMessage("");
    });

    on("queue-left", ()=> {
      if (this.battle.phase=== "queue") this.battle.phase= "idle";
    });

    on("battle-start", (message)=> {
      const game= new SudokuGame(message.puzzle, {values: message.board.flat()});
      // keep the notes written before a reconnection
      const previous= this.battle.battleId=== message.battleId ? this.battle.game : null;
      if (previous) game.notes= previous.notes;

      game.addEventListener("change", (event)=> {
        if (this.battle.game!== game || this.battle.phase!== "playing") return this.render();

        for (const {index, value} of event.detail.changes){
          this.battleClient.send({type: "move", x: index % 9, y: Math.floor(index / 9), value});
        }
        this.render();
      });

      this.battle= {
        ...this.battle,
        phase: message.startsInMs> 0 ? "countdown" : "playing",
        battleId: message.battleId,
        game,
        difficulty: message.difficulty,
        startsAt: Date.now() + message.startsInMs,
        elo: message.elo,
        opponent: message.opponent,
        result: null,
      };
      if (this.mode!== "battle") this.setMode("battle");
      this.selectedIndex= null;
      this.showMessage("");
    });

    on("opponent-progress", ({filled, total})=> {
      if (this.battle.opponent) this.battle.opponent.progress= {filled, total};
    });

    on("opponent-connection", ({connected, graceMs})=> {
      if (! this.battle.opponent) return;
      this.battle.opponent.connected= connected;
      this.showMessage(connected
        ? "Your opponent is back."
        : `Your opponent disconnected: they have ${Math.round(graceMs / 1000)} seconds to come back.`);
    });

    on("board-incorrect", ()=> {
      this.showMessage("Every cell is filled but something is wrong: look for the mistake!", "error");
    });

    on("battle-end", (result)=> {
      this.battle.phase= "over";
      this.battle.result= result;
      this.battle.game.reveal(result.solution);
      if (this.user) this.user.elo= result.elo;
      this.#renderAccountButton();
      this.#showBattleResult(result);
    });

    on("replaced", ()=> {
      this.battle= {phase: "idle", game: null, connected: false};
      this.showMessage("You opened the battle in another window.", "error");
    });

    on("error", ({message})=> {
      this.showMessage(message, "error");
    });
  }

  #showBattleResult(result){
    const won= result.result=== "win";
    const opponent= this.battle.opponent?.username ?? "Your opponent";
    const reasons= {
      solved: won ? `You solved it first, in ${formatDuration(result.durationMs)}.` : `${opponent} solved it first, in ${formatDuration(result.durationMs)}.`,
      resign: won ? `${opponent} resigned.` : "You resigned.",
      disconnect: won ? `${opponent} left the battle.` : "You were disconnected for too long.",
    };

    const modal= new Modal(won ? "Victory!" : "Defeat");
    modal.setContent(
      el("p", {text: reasons[result.reason]}),
      el("p", {className: "big-number", text: `${result.eloChange> 0 ? "+" : ""}${result.eloChange}`}),
      el("p", {className: "muted", text: `Your elo is now ${result.elo}.`}),
      el("div", {className: "modal-actions"},
        el("button", {className: "button", type: "button", text: "Close", onClick: ()=> modal.hide()}),
        el("button", {className: "button button-primary", type: "button", text: "Find another opponent", onClick: ()=> {
          modal.hide();
          this.joinQueue();
        }}),
      ),
    );
    modal.show();
  }

  //////           //////
  ////// rendering //////
  //////           //////

  #tick(){
    if (this.battle.phase=== "countdown" && Date.now()>= this.battle.startsAt){
      this.battle.phase= "playing";
      this.render();
      return;
    }
    this.#renderClock();
  }

  #renderClock(){
    const clock= this.statusBar.querySelector(".clock");
    if (! clock) return;

    let text= "";
    if (this.mode=== "solo" && this.solo){
      if (this.solo.status=== "playing") text= formatDuration(Date.now() - this.solo.startedAt + this.solo.hintsUsed * HINT_PENALTY_MS);
      else if (this.solo.status=== "won") text= formatDuration(this.solo.durationMs);
      else text= "--:--";
    }
    else if (this.battle.phase=== "queue"){
      text= formatDuration(Date.now() - this.battle.queueSince);
    }
    else if (this.battle.phase=== "playing"){
      text= formatDuration(Date.now() - this.battle.startsAt);
    }
    else if (this.battle.phase=== "over"){
      text= formatDuration(this.battle.result.durationMs);
    }
    clock.textContent= text;

    if (this.battle.phase=== "countdown"){
      this.board.setOverlay(String(Math.max(1, Math.ceil((this.battle.startsAt - Date.now()) / 1000))));
    }
  }

  render(){
    const game= this.currentGame();
    document.body.dataset.mode= this.mode;

    this.soloTab.setAttribute("aria-selected", String(this.mode=== "solo"));
    this.battleTab.setAttribute("aria-selected", String(this.mode=== "battle"));

    this.#renderStatusBar();

    if (game){
      this.board.render(game, this.canPlay() || game.readOnly ? this.selectedIndex : null);
    }
    this.board.setOverlay(this.#boardOverlayText());

    const playing= this.canPlay();
    this.controls.undo.disabled= ! playing || ! game?.canUndo;
    this.controls.erase.disabled= ! playing;
    this.controls.pencil.disabled= ! playing;
    this.controls.pencil.setAttribute("aria-pressed", String(this.pencil));
    this.controls.pencil.classList.toggle("active", this.pencil);
    this.controls.hint.hidden= this.mode!== "solo";
    this.controls.solution.hidden= this.mode!== "solo";
    this.controls.hint.disabled= ! playing;
    this.controls.solution.disabled= ! playing;

    this.numberKeys.forEach((key, i)=> {
      const remaining= game ? game.remaining(i+1) : 9;
      key.count.textContent= remaining> 0 ? String(remaining) : "";
      key.disabled= ! playing;
      key.classList.toggle("done", remaining<= 0);
      key.classList.toggle("pencil", this.pencil);
    });

    this.#renderClock();
  }

  #boardOverlayText(){
    if (this.mode=== "solo") return this.solo ? null : "Loading…";

    switch (this.battle.phase){
      case "idle": return this.user ? "Find an opponent to start" : "Log in to battle";
      case "queue": return "Looking for an opponent…";
      case "countdown": return String(Math.max(1, Math.ceil((this.battle.startsAt - Date.now()) / 1000)));
      default: return null;
    }
  }

  #renderStatusBar(){
    const parts= this.mode=== "solo" ? this.#soloStatus() : this.#battleStatus();
    this.statusBar.replaceChildren(...parts);
  }

  #soloStatus(){
    const difficultySelect= el("select", {className: "select", "aria-label": "Difficulty", onChange: (event)=> this.newSoloGame(event.target.value)},
      ...DIFFICULTIES.map(difficulty=> el("option", {value: difficulty, selected: difficulty=== this.solo?.difficulty, text: capitalize(difficulty)})),
    );

    const badge= ! this.solo ? null
      : this.solo.ownerId!== null ? el("span", {className: "badge", text: "Ranked"})
      : el("span", {className: "badge badge-muted", text: "Guest"});

    return [
      difficultySelect,
      el("span", {className: "clock", "aria-label": "Time"}),
      badge,
      el("button", {className: "button", type: "button", "aria-label": "New game", title: "New game", disabled: this.soloBusy, onClick: ()=> this.newSoloGame()},
        icon(ICONS.refresh),
        el("span", {className: "button-label", text: "New game"}),
      ),
    ];
  }

  #battleStatus(){
    if (! this.user){
      return [
        el("span", {text: "Battle players with your elo."}),
        el("button", {className: "button button-primary", type: "button", text: "Log in", onClick: ()=> this.accountDialog.show()}),
      ];
    }

    const {phase, opponent}= this.battle;
    if (phase=== "idle"){
      return [
        el("span", {text: `Your elo: ${this.user.elo}`}),
        el("button", {className: "button button-primary", type: "button", text: "Find opponent", onClick: ()=> this.joinQueue()}),
      ];
    }

    if (phase=== "queue"){
      return [
        el("span", {text: "Searching"}),
        el("span", {className: "clock"}),
        el("button", {className: "button", type: "button", text: "Cancel", onClick: ()=> this.leaveQueue()}),
      ];
    }

    const progressBar= (label, {filled, total})=> el("div", {className: "progress"},
      el("span", {className: "progress-label", text: label}),
      el("div", {className: "progress-track", role: "progressbar", "aria-valuemin": 0, "aria-valuemax": total, "aria-valuenow": filled, "aria-label": `${label} progress`},
        el("div", {className: "progress-fill", style: `width: ${total ? (filled / total) * 100 : 0}%`}),
      ),
    );

    const game= this.battle.game;
    const total= game.givens.filter(given=> ! given).length;
    const filled= game.values.filter((value, index)=> value!== null && ! game.givens[index]).length;

    return [
      el("div", {className: "versus"},
        el("span", {className: "versus-names", text: `${this.user.username} (${this.battle.elo}) vs ${opponent.username} (${opponent.elo})${opponent.connected ? "" : " · disconnected"}`}),
        progressBar("You", {filled, total}),
        progressBar(opponent.username, opponent.progress),
      ),
      el("span", {className: "badge", text: capitalize(this.battle.difficulty)}),
      el("span", {className: "clock"}),
      phase=== "over"
        ? el("button", {className: "button button-primary", type: "button", text: "Find opponent", onClick: ()=> this.joinQueue()})
        : el("button", {className: "button", type: "button", text: "Resign", onClick: ()=> this.resign()}, icon(ICONS.flag)),
    ];
  }
}

document.addEventListener("DOMContentLoaded", ()=> {
  applyRandomPalette();
  new App().start();
});
