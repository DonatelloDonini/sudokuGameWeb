/**
 * The state of a sudoku being played: numbers, pencil notes and undo history.\
 * Cells are addressed by index (y*9 + x). Notes are stored as bitmasks (bit n set = note n).
 *
 * Events:
 * - "change": something changed, `detail.changes` lists the cells whose number changed as {index, value}.
 */
export default class SudokuGame extends EventTarget{
  static SIZE= 9;
  static CELLS= 81;
  static MAX_HISTORY= 300;

  /** @type {number[][]} For each cell, the indexes of the cells in its row, column and quadrant. */
  static PEERS= Array.from({length: SudokuGame.CELLS}, (_, index)=> {
    const x= index % 9;
    const y= Math.floor(index / 9);
    const peers= new Set();

    for (let i= 0; i<9; i++){
      peers.add(y*9 + i);
      peers.add(i*9 + x);
    }

    const quadrantX= x - x%3;
    const quadrantY= y - y%3;
    for (let dy= 0; dy<3; dy++){
      for (let dx= 0; dx<3; dx++){
        peers.add((quadrantY+dy)*9 + quadrantX + dx);
      }
    }

    peers.delete(index);
    return [...peers];
  });

  /**
   * @param {(number|null)[][]} puzzle The level, indexed as puzzle[y][x], empty cells are null.
   * @param {Object} [savedState] A state returned by toJSON, to resume a game.
   */
  constructor(puzzle, savedState= {}){
    super();
    this.puzzle= puzzle;
    this.givens= puzzle.flat().map(value=> value!== null);
    this.values= savedState.values ?? puzzle.flat();
    this.notes= savedState.notes ?? new Array(SudokuGame.CELLS).fill(0);
    /** Cells filled by a hint: they are correct, so they are locked like the givens. */
    this.hinted= new Set(savedState.hinted ?? []);
    /** Cells filled when the solution was shown. */
    this.revealed= new Set(savedState.revealed ?? []);
    this.readOnly= savedState.readOnly ?? false;
    this.history= [];
  }

  //////         //////
  ////// queries //////
  //////         //////

  /**
   * @returns {boolean} Whether the player can't change the cell.
   */
  isLocked(index){
    return this.readOnly || this.givens[index] || this.hinted.has(index);
  }

  hasNote(index, digit){
    return (this.notes[index] & (1 << digit))!== 0;
  }

  /**
   * @returns {Set<number>} The indexes of the cells whose number is repeated in their row, column or quadrant.
   */
  conflicts(){
    const conflicts= new Set();
    this.values.forEach((value, index)=> {
      if (value=== null) return;
      if (SudokuGame.PEERS[index].some(peer=> this.values[peer]=== value)) conflicts.add(index);
    });
    return conflicts;
  }

  /**
   * @returns {number} How many more times the digit can be placed.
   */
  remaining(digit){
    return 9 - this.values.filter(value=> value=== digit).length;
  }

  isFilled(){
    return this.values.every(value=> value!== null);
  }

  /**
   * @returns {boolean} Whether every cell is filled without breaking any rule.
   *                    Levels have a single solution, so this means the sudoku is solved.
   */
  isComplete(){
    return this.isFilled() && this.conflicts().size=== 0;
  }

  /**
   * @returns {(number|null)[][]} The current numbers as a 9x9 array, as the server expects them.
   */
  board(){
    return Array.from({length: 9}, (_, y)=> this.values.slice(y*9, y*9 + 9));
  }

  //////         //////
  ////// actions //////
  //////         //////

  /**
   * Places a number (or removes it with null). Placing a number clears the cell's notes
   * and removes that number from the notes of the cells it sees.
   */
  setValue(index, value){
    if (this.isLocked(index) || this.values[index]=== value) return;

    this.#record();
    this.values[index]= value;
    if (value!== null){
      this.notes[index]= 0;
      SudokuGame.PEERS[index].forEach(peer=> {
        this.notes[peer]&= ~(1 << value);
      });
    }
    this.#emitChange([{index, value}]);
  }

  /**
   * Adds the note if missing, removes it otherwise. Only empty cells can hold notes.
   */
  toggleNote(index, digit){
    if (this.isLocked(index) || this.values[index]!== null) return;

    this.#record();
    this.notes[index]^= (1 << digit);
    this.#emitChange([]);
  }

  /**
   * Removes the number, or the notes if the cell has no number.
   */
  erase(index){
    if (this.isLocked(index)) return;

    if (this.values[index]!== null){
      this.setValue(index, null);
    }
    else if (this.notes[index]!== 0){
      this.#record();
      this.notes[index]= 0;
      this.#emitChange([]);
    }
  }

  /**
   * Fills a cell with the number given by a hint and locks it.\
   * The history is cleared: the hint has already been paid for, it can't be undone.
   */
  applyHint(index, value){
    this.history= [];
    this.values[index]= value;
    this.notes[index]= 0;
    SudokuGame.PEERS[index].forEach(peer=> {
      this.notes[peer]&= ~(1 << value);
    });
    this.hinted.add(index);
    this.#emitChange([{index, value}]);
  }

  /**
   * Shows the solution: wrong and empty cells get the right number and the game becomes read only.
   * @param {number[][]} solution
   */
  reveal(solution){
    const changes= [];
    solution.flat().forEach((value, index)=> {
      if (this.values[index]!== value){
        this.values[index]= value;
        this.revealed.add(index);
        changes.push({index, value});
      }
      this.notes[index]= 0;
    });
    this.readOnly= true;
    this.history= [];
    this.#emitChange(changes);
  }

  undo(){
    if (this.readOnly) return;

    const previous= this.history.pop();
    if (! previous) return;

    const changes= [];
    previous.values.forEach((value, index)=> {
      if (this.values[index]!== value) changes.push({index, value});
    });

    this.values= previous.values;
    this.notes= previous.notes;
    this.hinted= previous.hinted;
    this.#emitChange(changes);
  }

  get canUndo(){
    return ! this.readOnly && this.history.length> 0;
  }

  /**
   * @returns {Object} What's needed to resume the game later (see the constructor).
   */
  toJSON(){
    return {
      values: this.values,
      notes: this.notes,
      hinted: [...this.hinted],
      revealed: [...this.revealed],
      readOnly: this.readOnly,
    };
  }

  #record(){
    this.history.push({values: [...this.values], notes: [...this.notes], hinted: new Set(this.hinted)});
    if (this.history.length> SudokuGame.MAX_HISTORY) this.history.shift();
  }

  #emitChange(changes){
    this.dispatchEvent(new CustomEvent("change", {detail: {changes}}));
  }
}
