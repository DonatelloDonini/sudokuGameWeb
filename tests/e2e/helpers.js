import { execFileSync } from "node:child_process";
import { expect } from "@playwright/test";
import { CLI, E2E_DATABASE } from "./config.js";

/**
 * @returns {string} A username no other test uses (3-20 letters, numbers or underscores).
 */
export const uniqueName= (prefix)=> `${prefix}_${Math.random().toString(36).slice(2, 8)}`.slice(0, 20);

/**
 * Opens the game and waits for the board.
 */
export const openGame= async (page)=> {
  await page.goto("/");
  await expect(page.locator(".cell")).toHaveCount(81);
  await expect(page.locator(".status-bar .clock")).toBeVisible();
};

export const register= async (page, username, password= "secret123")=> {
  await page.locator(".account-button").click();
  await page.getByRole("tab", {name: "Register"}).click();
  await page.locator("input[name=username]").fill(username);
  await page.locator("input[name=password]").fill(password);
  await page.locator(".account-form button[type=submit]").click();
  await expect(page.locator(".account-label")).toHaveText(new RegExp(`^${username} · \\d+$`));
};

/** Gives the user admin rights, with the command line tool admins use. */
export const makeAdmin= (username)=> {
  execFileSync(process.execPath, ["--disable-warning=ExperimentalWarning", CLI, "make-admin", username], {
    env: {...process.env, DATABASE_PATH: E2E_DATABASE},
  });
};

/**
 * @returns {Promise<(number|null)[]>} The 81 cells of the board on screen, null for the cells the player fills.
 */
export const givensOnPage= (page)=> page.locator(".cell").evaluateAll(cells=> cells.map(cell=> (
  cell.classList.contains("given") ? Number(cell.querySelector(".value").textContent) : null
)));

/**
 * Solves the board on screen with the public API.
 * @returns {Promise<{puzzle: (number|null)[], solution: number[]}>} Both as 81 cells.
 */
export const solveOnPage= async (page)=> {
  const puzzle= await givensOnPage(page);
  const response= await page.request.post("/api/v1/solve", {
    data: {puzzle: puzzle.map(cell=> cell ?? 0).join("")},
  });
  const {solution}= await response.json();
  return {puzzle, solution: solution.flat()};
};

/**
 * Types numbers in the empty cells, by selecting each cell and pressing the key.
 * @param {Object} [options]
 * @param {number} [options.leave] How many cells to leave empty at the end.
 */
export const fillCells= async (page, {puzzle, solution}, {leave= 0}= {})=> {
  const empty= puzzle.flatMap((cell, index)=> cell=== null ? [index] : []);
  for (const index of empty.slice(0, empty.length - leave)){
    await selectCell(page, index);
    await page.keyboard.press(String(solution[index]));
  }
  return empty.slice(empty.length - leave);
};

export const selectCell= async (page, index)=> {
  await page.locator(`.cell[data-index="${index}"]`).dispatchEvent("pointerdown");
};

export const cell= (page, index)=> page.locator(`.cell[data-index="${index}"]`);
