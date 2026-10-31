import { el } from "./utils.js";

/**
 * A dialog shown over a blurred backdrop, built like the minesweeper's ModalMessage but holding any content.\
 * It closes with its X button, by clicking the backdrop or by pressing Escape (unless `dismissible` is false).
 */
export default class Modal{
  /** @type {Modal[]} The modals currently shown, the last one on top. */
  static #openModals= [];

  /** @type {HTMLElement} */
  #maskElement;

  /** @type {HTMLElement} */
  #panelElement;

  /** @type {HTMLElement} */
  #bodyElement;

  /**
   * @param {string} title
   * @param {Object} [options]
   * @param {boolean} [options.dismissible] Whether the user can close it (default true).
   * @param {Function} [options.onClose] Called after the modal is hidden.
   * @param {boolean} [options.wide] For bigger contents (e.g. the avatar editor).
   */
  constructor(title, options= {}){
    this.title= title;
    this.wide= options.wide ?? false;
    this.dismissible= options.dismissible ?? true;
    this.onClose= options.onClose ?? (()=> {});
    this.isShown= false;

    this.#init();
  }

  /**
   * @returns {boolean} Whether any modal is open (keyboard shortcuts are disabled meanwhile).
   */
  static get anyOpen(){
    return Modal.#openModals.length> 0;
  }

  #init(){
    this.#bodyElement= el("div", {className: "modal-body"});

    const titleId= `modal-title-${Math.random().toString(36).slice(2)}`;
    this.#panelElement= el("div", {className: `modal-panel${this.wide ? " modal-wide" : ""}`, role: "dialog", "aria-modal": "true", "aria-labelledby": titleId},
      el("h2", {className: "modal-title", id: titleId, text: this.title}),
      this.#bodyElement,
    );

    if (this.dismissible){
      this.#panelElement.prepend(el("button", {
        className: "modal-close",
        type: "button",
        "aria-label": "Close",
        text: "✕",
        onClick: ()=> this.hide(),
      }));
    }

    this.#maskElement= el("div", {className: "modal-mask"}, this.#panelElement);
    this.#maskElement.addEventListener("click", (event)=> {
      if (this.dismissible && event.target=== this.#maskElement) this.hide();
    });
  }

  #onKeyDown= (event)=> {
    const isTopModal= Modal.#openModals.at(-1)=== this;
    if (event.key=== "Escape" && this.dismissible && isTopModal) this.hide();
  };

  /**
   * Replaces the content of the modal.
   *
   * @param {...(Node|string)} children
   *
   * @returns {Modal} The modal itself, for chaining.
   */
  setContent(...children){
    this.#bodyElement.replaceChildren(...children.filter(child=> child!== null && child!== undefined));
    return this;
  }

  show(){
    if (this.isShown) return this;

    document.body.appendChild(this.#maskElement);
    document.addEventListener("keydown", this.#onKeyDown);
    Modal.#openModals.push(this);
    this.isShown= true;

    this.#panelElement.querySelector("input, button:not(.modal-close)")?.focus();
    return this;
  }

  hide(){
    if (! this.isShown) return this;

    this.#maskElement.remove();
    document.removeEventListener("keydown", this.#onKeyDown);
    Modal.#openModals= Modal.#openModals.filter(modal=> modal!== this);
    this.isShown= false;

    this.onClose();
    return this;
  }

  /**
   * Shows a question with confirm / cancel buttons.
   *
   * @param {string} title
   * @param {string} message
   * @param {string} [confirmLabel]
   *
   * @returns {Promise<boolean>} Whether the user confirmed.
   */
  static confirm(title, message, confirmLabel= "Confirm"){
    return new Promise((resolve)=> {
      let confirmed= false;
      const modal= new Modal(title, {onClose: ()=> resolve(confirmed)});

      modal.setContent(
        el("p", {text: message}),
        el("div", {className: "modal-actions"},
          el("button", {className: "button", type: "button", text: "Cancel", onClick: ()=> modal.hide()}),
          el("button", {className: "button button-primary", type: "button", text: confirmLabel, onClick: ()=> {
            confirmed= true;
            modal.hide();
          }}),
        ),
      );
      modal.show();
    });
  }
}
