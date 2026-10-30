/**
 * Applies the specified style to the given element.
 *
 * @param {HTMLElement} element The element to apply the style to.
 * @param {object} style The style object containing CSS properties and values.
 *
 * @returns {void}
 */
export const css= (element, style)=> {
  Object.keys(style).forEach((key)=> {
    // Custom properties (e.g. "--size") can only be set through setProperty
    if (key.startsWith("--")){
      element.style.setProperty(key, style[key]);
    }
    else{
      element.style[key]= style[key];
    }
  });
};

/**
 * Creates an element.
 *
 * @param {string} tag The tag name.
 * @param {Object} [attributes] Attributes to set; "className", "text" and "on<Event>" are handled specially.
 * @param {...(Node|string)} children
 *
 * @returns {HTMLElement}
 */
export const el= (tag, attributes= {}, ...children)=> {
  const element= document.createElement(tag);

  for (const [name, value] of Object.entries(attributes)){
    if (value=== undefined || value=== null || value=== false) continue;

    if (name=== "className") element.className= value;
    else if (name=== "text") element.textContent= value;
    else if (name.startsWith("on")) element.addEventListener(name.slice(2).toLowerCase(), value);
    else element.setAttribute(name, value=== true ? "" : value);
  }

  element.append(...children.filter(child=> child!== null && child!== undefined));
  return element;
};

/**
 * Builds an inline SVG icon from path data (24x24 viewBox, drawn with the current text color).
 *
 * @param {string} pathData The "d" attribute of the icon's path.
 *
 * @returns {SVGElement}
 */
export const icon= (pathData)=> {
  const namespace= "http://www.w3.org/2000/svg";
  const svg= document.createElementNS(namespace, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("icon");

  const path= document.createElementNS(namespace, "path");
  path.setAttribute("d", pathData);
  svg.appendChild(path);
  return svg;
};

/** Material Design icon paths (Apache 2.0). */
export const ICONS= Object.freeze({
  trophy: "M18 2c-.9 0-2 1-2 2H8c0-1-1.1-2-2-2H2v9c0 1 1 2 2 2h2.2c.4 2 1.7 3.7 4.8 4v2.08C8 19.54 8 22 8 22h8s0-2.46-3-2.92V17c3.1-.3 4.4-2 4.8-4H20c1 0 2-1 2-2V2h-4M6 11H4V4h2v7m14 0h-2V4h2v7Z",
  user: "M12 4a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4m0 10c4.42 0 8 1.79 8 4v2H4v-2c0-2.21 3.58-4 8-4Z",
  undo: "M12.5 8c-2.65 0-5.05 1-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8Z",
  eraser: "M16.24 3.56l4.95 4.94c.78.79.78 2.05 0 2.84L12 20.53a4.008 4.008 0 0 1-5.66 0L2.81 17c-.78-.79-.78-2.05 0-2.84l10.6-10.6c.79-.78 2.05-.78 2.83 0M4.22 15.58l3.54 3.53c.78.79 2.04.79 2.83 0l3.53-3.53-4.95-4.95-4.95 4.95Z",
  pencil: "M20.71 7.04c.39-.39.39-1.04 0-1.41l-2.34-2.34c-.37-.39-1.02-.39-1.41 0l-1.84 1.83 3.75 3.75M3 17.25V21h3.75L17.81 9.93l-3.75-3.75L3 17.25Z",
  lightbulb: "M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7M9 21a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-1H9v1Z",
  eye: "M12 9a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3m0 8a5 5 0 0 1-5-5 5 5 0 0 1 5-5 5 5 0 0 1 5 5 5 5 0 0 1-5 5m0-12.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5Z",
  flag: "M14.4 6 14 4H5v17h2v-7h5.6l.4 2h7V6h-5.6Z",
  refresh: "M17.65 6.35A7.958 7.958 0 0 0 12 4a8 8 0 0 0-8 8 8 8 0 0 0 8 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18a6 6 0 0 1-6-6 6 6 0 0 1 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35Z",
});

/**
 * @param {number} ms A duration in milliseconds.
 *
 * @returns {string} The duration as "m:ss", or "h:mm:ss" past one hour.
 */
export const formatDuration= (ms)=> {
  const totalSeconds= Math.max(0, Math.floor(ms / 1000));
  const hours= Math.floor(totalSeconds / 3600);
  const minutes= Math.floor((totalSeconds % 3600) / 60);
  const seconds= String(totalSeconds % 60).padStart(2, "0");

  return hours> 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
};

/**
 * Reads a JSON value from localStorage, silently returning the fallback when the storage is unavailable or the value is invalid.
 */
export const loadFromStorage= (key, fallback= null)=> {
  try {
    const stored= localStorage.getItem(key);
    return stored=== null ? fallback : JSON.parse(stored);
  }
  catch {
    return fallback;
  }
};

/**
 * Writes a JSON value to localStorage (null removes it), silently doing nothing when the storage is unavailable.
 */
export const saveToStorage= (key, value)=> {
  try {
    if (value=== null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  }
  catch {}
};
