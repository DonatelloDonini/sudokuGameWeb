import { el } from "../utils.js";

/**
 * A panel of the dashboard's pages (a card), with an optional title and toolbar.
 *
 * @param {Object} options
 * @param {string} [options.title]
 * @param {Node[]} [options.actions] Shown on the right of the title.
 * @param {string} [options.className]
 * @param {...Node} children
 * @returns {HTMLElement}
 */
export const panel= ({title= null, actions= [], className= ""}= {}, ...children)=> el("section", {className: `dashboardPanel ${className}`.trim()},
  title || actions.length> 0
    ? el("header", {className: "panelHeader"}, title ? el("h2", {text: title}) : el("span"), el("div", {className: "panelActions"}, ...actions))
    : null,
  ...children,
);

/**
 * A big number with its label (for totals: a number is clearer than a chart).
 *
 * @param {string} label
 * @param {string|number} value
 * @param {Object} [options]
 * @param {string} [options.hint] A line under the number.
 * @param {Function} [options.onClick] Makes the tile a button.
 * @returns {HTMLElement}
 */
export const statTile= (label, value, {hint= null, onClick= null}= {})=> {
  const content= [
    el("span", {className: "tileValue", text: String(value)}),
    el("span", {className: "tileLabel", text: label}),
    hint ? el("span", {className: "tileHint", text: hint}) : null,
  ];
  return onClick
    ? el("button", {className: "statTile clickable", type: "button", onClick}, ...content)
    : el("div", {className: "statTile"}, ...content);
};

/**
 * A segmented control (one choice among a few), like the period picker of the OpenCV Editor's stats.
 *
 * @param {Object} options
 * @param {{label: string, value: string}[]} options.segments
 * @param {string} options.value
 * @param {string} options.ariaLabel
 * @param {Function} options.onChange Called with the new value.
 * @returns {HTMLElement}
 */
export const segmentedButton= ({segments, value, ariaLabel, onChange})=> {
  const group= el("div", {className: "segmented", role: "radiogroup", "aria-label": ariaLabel});
  const buttons= segments.map(segment=> el("button", {
    type: "button",
    role: "radio",
    "aria-checked": String(segment.value=== value),
    text: segment.label,
    onClick: ()=> {
      buttons.forEach(button=> button.setAttribute("aria-checked", String(button=== buttonOf(segment.value))));
      onChange(segment.value);
    },
  }));
  const buttonOf= (segmentValue)=> buttons[segments.findIndex(segment=> segment.value=== segmentValue)];

  group.append(...buttons);
  return group;
};

/**
 * @param {string} text
 * @param {"neutral"|"accent"|"danger"} [kind]
 * @returns {HTMLElement}
 */
export const badge= (text, kind= "neutral")=> el("span", {className: `badge badge-${kind}`, text});

/**
 * Shows an error in place of a page's content.
 */
export const errorMessage= (error)=> el("p", {className: "errorText", role: "alert", text: error.message ?? String(error)});
