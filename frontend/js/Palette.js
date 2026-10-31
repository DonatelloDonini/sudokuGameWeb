/**
 * CSS variables the palette is assigned to, ordered from lightest to darkest color.
 */
export const PALETTE_VARIABLES= ["--background", "--shadow", "--containers", "--detail", "--foreground"];

const randomBetween= (min, max)=> min + Math.random() * (max - min);

/**
 * Converts an HSL color to a hex string.
 *
 * @param {number} h Hue in degrees [0, 360).
 * @param {number} s Saturation [0, 1].
 * @param {number} l Lightness [0, 1].
 *
 * @returns {string} The color as "#rrggbb".
 */
export const hslToHex= (h, s, l)=> {
  const a = s * Math.min(l, 1 - l);
  const channel = (n) => {
    const k = (n + h / 30) % 12;
    const value = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(value * 255).toString(16).padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
};

/**
 * Computes the relative luminance (WCAG) of a hex color.
 *
 * @param {string} hex The color as "#rrggbb".
 *
 * @returns {number} Luminance in [0, 1], 0 being black.
 */
export const luminance= (hex)=> {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/**
 * Generates a random, harmonious palette of five colors, sorted from lightest to darkest.
 * Hues follow a randomly chosen color scheme around a random base hue,
 * lightness is spread across the range so the colors stay distinguishable.
 *
 * @returns {string[]} Five hex colors, lightest first.
 */
export const generatePalette= ()=> {
  const schemes = {
    analogous: [0, 20, 40, -20, -40],
    complementary: [0, 15, 180, 195, -15],
    triadic: [0, 120, 240, 10, 130],
    splitComplementary: [0, 150, 210, 10, 160],
    monochromatic: [0, 0, 0, 0, 0],
  };
  const offsets = Object.values(schemes)[Math.floor(Math.random() * Object.keys(schemes).length)];
  const baseHue = Math.random() * 360;
  const lightnessSteps = [0.9, 0.72, 0.55, 0.38, 0.2];

  return offsets
    .map((offset, i) => hslToHex(
      (baseHue + offset + randomBetween(-8, 8) + 360) % 360,
      randomBetween(0.35, 0.8),
      Math.min(0.95, Math.max(0.08, lightnessSteps[i] + randomBetween(-0.06, 0.06)))
    ))
    .sort((a, b) => luminance(b) - luminance(a));
};

/**
 * Assigns a palette to the palette CSS variables on :root.
 * Colors go lightest to darkest, reversed when the browser prefers a dark theme.
 *
 * @param {string[]} palette Five hex colors, lightest first.
 * @param {boolean} dark Whether to apply the reversed (dark theme) order.
 *
 * @returns {void}
 */
export const applyPalette= (palette, dark)=> {
  const ordered = dark ? [...palette].reverse() : palette;
  PALETTE_VARIABLES.forEach((variable, i) => {
    document.documentElement.style.setProperty(variable, ordered[i]);
  });
};

/**
 * Generates a random palette and applies it, following the browser color scheme
 * and re-applying the same palette whenever the scheme changes.
 *
 * @returns {string[]} The generated colors, lightest first.
 */
export const applyRandomPalette= ()=> {
  const palette = generatePalette();
  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  applyPalette(palette, darkQuery.matches);
  darkQuery.addEventListener("change", (event) => applyPalette(palette, event.matches));
  return palette;
};
