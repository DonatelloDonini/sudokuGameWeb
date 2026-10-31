import { el, icon } from "../utils.js";

/**
 * An entry of the dashboard's side menu, like in the OpenCV Editor: an icon and a label that open a page
 * of the dashboard when clicked. The page is drawn by a module exporting `render(main)`, which fills <main>
 * (emptied first).
 *
 * Opening one marks it active (and the others inactive), then fires a bubbling "dashboard-option-open" event
 * with its id in `detail.id`. The pages are listed in js/admin/pages.js.
 *
 * @example
 * <dashboard-option id="stats" icon="M3,11H11V3H3..." module="./pages/stats.js">Stats</dashboard-option>
 */
export default class DashboardOption extends HTMLElement{
  #initialized= false;

  connectedCallback(){
    if (this.#initialized) return;
    this.#initialized= true;

    const label= el("span", {className: "optionLabel", text: this.textContent.trim()});
    // names the option when its label doesn't show: cut short, or left out of the collapsed sidebar
    this.title= label.textContent;
    this.setAttribute("role", "button");
    this.setAttribute("tabindex", "0");

    this.replaceChildren(icon(this.getAttribute("icon")), label);
    this.addEventListener("click", ()=> this.open());
    this.addEventListener("keydown", (event)=> {
      if (event.key=== "Enter" || event.key=== " "){
        event.preventDefault();
        this.open();
      }
    });
  }

  /**
   * Opens the page: imports its module and lets it draw into <main>.
   *
   * @returns {Promise<void>}
   */
  async open(){
    document.querySelectorAll("dashboard-option.active").forEach(option=> {
      option.classList.remove("active");
      option.removeAttribute("aria-current");
    });
    this.classList.add("active");
    this.setAttribute("aria-current", "page");
    // the side menu scrolls: show the opened option
    this.scrollIntoView({block: "nearest"});

    const module= await import(new URL(this.getAttribute("module"), import.meta.url));

    // another option was opened while this module was loading
    if (! this.classList.contains("active")) return;

    const main= document.getElementById("dashboardMain");
    main.replaceChildren();
    this.dispatchEvent(new CustomEvent("dashboard-option-open", {bubbles: true, detail: {id: this.id}}));

    await module.render(main);
  }
}

customElements.define("dashboard-option", DashboardOption);
