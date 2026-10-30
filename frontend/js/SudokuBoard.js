import SudokuGame from "./SudokuGame.js";
import { el } from "./utils.js";

/**
 * The 9x9 grid on screen. It only draws a SudokuGame and reports which cell the player picks.
 *
 * Events:
 * - "select": a cell was clicked or tapped, `detail.index` is its index.
 */
export default class SudokuBoard extends EventTarget{
  /** @type {HTMLElement} */
  #DOMElement;

  /** @type {{cell: HTMLElement, value: HTMLElement, notes: HTMLElement[]}[]} */
  #cells= [];

  constructor(){
    super();
    this.#init();
  }

  #init(){
    this.#DOMElement= el("div", {className: "sudoku-board", role: "grid", "aria-label": "Sudoku board"});

    for (let y= 0; y<9; y++){
      const row= el("div", {className: "sudoku-row", role: "row"});

      for (let x= 0; x<9; x++){
        const index= y*9 + x;
        const notes= Array.from({length: 9}, (_, i)=> el("span", {className: "note", "data-digit": i+1}));
        const value= el("span", {className: "value"});
        const cell= el("div", {
          className: [
            "cell",
            (x%3=== 2 && x< 8) ? "box-right" : "",
            (y%3=== 2 && y< 8) ? "box-bottom" : "",
          ].join(" ").trim(),
          role: "gridcell",
          "data-index": index,
        }, value, el("div", {className: "notes"}, ...notes));

        cell.addEventListener("pointerdown", (event)=> {
          event.preventDefault();
          this.dispatchEvent(new CustomEvent("select", {detail: {index}}));
        });

        this.#cells.push({cell, value, notes});
        row.appendChild(cell);
      }

      this.#DOMElement.appendChild(row);
    }
  }

  /**
   * Draws the game.
   *
   * @param {SudokuGame} game
   * @param {number|null} selectedIndex The selected cell, if any.
   */
  render(game, selectedIndex){
    const conflicts= game.conflicts();
    const selectedValue= selectedIndex=== null ? null : game.values[selectedIndex];
    const peers= new Set(selectedIndex=== null ? [] : SudokuGame.PEERS[selectedIndex]);

    this.#cells.forEach(({cell, value, notes}, index)=> {
      const cellValue= game.values[index];
      value.textContent= cellValue ?? "";

      notes.forEach((note, i)=> {
        const digit= i+1;
        const visible= cellValue=== null && game.hasNote(index, digit);
        note.textContent= visible ? digit : "";
        note.classList.toggle("highlighted", visible && digit=== selectedValue);
      });

      cell.classList.toggle("given", game.givens[index]);
      cell.classList.toggle("hinted", game.hinted.has(index));
      cell.classList.toggle("revealed", game.revealed.has(index));
      cell.classList.toggle("conflict", conflicts.has(index));
      cell.classList.toggle("selected", index=== selectedIndex);
      cell.classList.toggle("peer", peers.has(index));
      cell.classList.toggle("same-value", selectedValue!== null && cellValue=== selectedValue && index!== selectedIndex);

      const x= index % 9 + 1;
      const y= Math.floor(index / 9) + 1;
      cell.setAttribute("aria-label", `Row ${y}, column ${x}, ${cellValue ?? "empty"}${game.givens[index] ? ", given" : ""}`);
      cell.setAttribute("aria-selected", index=== selectedIndex ? "true" : "false");
    });

    this.#DOMElement.classList.toggle("read-only", game.readOnly);
  }

  /**
   * Hides the numbers behind a message (used for the battle countdown), or shows them again with null.
   *
   * @param {string|null} text
   */
  setOverlay(text){
    this.#DOMElement.querySelector(".board-overlay")?.remove();
    if (text!== null) this.#DOMElement.appendChild(el("div", {className: "board-overlay", text}));
  }

  get DOMElement(){
    return this.#DOMElement;
  }
}
