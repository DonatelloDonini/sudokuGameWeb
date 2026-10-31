import Modal from "./Modal.js";
import { el } from "./utils.js";

/**
 * @typedef {Object} RulesSection
 * @property {string} title The section title.
 * @property {string[]} items The rules of the section, shown as a bulleted list.
 */

/**
 * A round "?" button that opens a panel with the given rules (same component as in the minesweeper game).
 */
export default class RulesButton{
  /** @type {HTMLElement} */
  #DOMElement;

  /** @type {Modal} */
  #modal;

  /**
   * @param {RulesSection[]} rules The rules shown inside the panel, one entry per section.
   */
  constructor(rules){
    this.rules= rules;
    this.#init();
  }

  #init(){
    this.#modal= new Modal("Rules");
    this.#modal.setContent(...this.rules.flatMap(section=> [
      el("h3", {className: "rules-title", text: section.title}),
      el("ul", {className: "rules-list"}, ...section.items.map(item=> el("li", {text: item}))),
    ]));

    this.#DOMElement= el("button", {
      className: "round-button rules-button",
      type: "button",
      title: "Rules",
      "aria-label": "Show the rules",
      text: "?",
      onClick: ()=> this.show(),
    });
  }

  show(){
    this.#modal.show();
  }

  get DOMElement(){
    return this.#DOMElement;
  }
}
