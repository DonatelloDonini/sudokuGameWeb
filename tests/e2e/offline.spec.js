import { test, expect } from "@playwright/test";
import { openGame, register, uniqueName, solveOnPage, fillCells, selectCell } from "./helpers.js";

const PER_DIFFICULTY= 5;

const savedLevels= (page)=> page.evaluate(()=> Object.values(JSON.parse(localStorage.getItem("sudoku-offline-levels") ?? "{}")).flat().length);

/** Opens the game online and waits until it can work offline: the service worker in control, the levels saved. */
const prepareOffline= async (page)=> {
  await openGame(page);
  await page.evaluate(()=> navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(()=> page.evaluate(()=> Boolean(navigator.serviceWorker.controller))).toBe(true);
  await expect.poll(()=> savedLevels(page), {timeout: 20_000}).toBe(4 * PER_DIFFICULTY);
};

test.describe("offline", ()=> {
  test("the game opens and plays offline with the saved puzzles", async ({page, context})=> {
    await prepareOffline(page);

    await context.setOffline(true);
    await page.reload();
    await expect(page.locator(".cell")).toHaveCount(81);
    await expect(page.getByRole("status").filter({hasText: "Offline"})).toBeVisible();

    await page.locator(".status-bar").getByRole("button", {name: "New game"}).click();
    await expect(page.locator(".status-bar .badge")).toHaveText("Offline");
    await expect(page.locator("#message")).toContainText("playing a puzzle saved on this device");
    expect(await savedLevels(page)).toBe(4 * PER_DIFFICULTY - 1);

    // hints work without the server
    await page.locator(".control-button", {hasText: "Hint"}).click();
    await expect(page.locator(".cell.hinted")).toHaveCount(1);

    // the board is checked on the device
    const solution= await page.evaluate(()=> JSON.parse(localStorage.getItem("sudoku-solo-game")).solution.flat());
    const puzzle= await page.locator(".cell").evaluateAll(cells=> cells.map(cell=> (
      cell.classList.contains("given") || cell.classList.contains("hinted") ? 1 : null
    )));
    await fillCells(page, {puzzle, solution});
    const victory= page.getByRole("dialog", {name: "Solved!"});
    await expect(victory).toContainText("Played offline: this game isn't ranked.");
    await victory.getByRole("button", {name: "Close"}).click();

    // no battles offline
    await page.getByRole("tab", {name: "Battle"}).click();
    await expect(page.locator(".board-overlay")).toHaveText("Battles need an internet connection");

    // back online: the saved puzzles are refilled
    await context.setOffline(false);
    await expect(page.getByRole("status").filter({hasText: "Offline"})).toBeHidden();
    await expect.poll(()=> savedLevels(page), {timeout: 20_000}).toBe(4 * PER_DIFFICULTY);
  });

  test("an online game finished offline is sent when the connection is back", async ({page, context})=> {
    await prepareOffline(page);
    await register(page, uniqueName("commuter"));
    await page.locator(".status-bar").getByRole("button", {name: "New game"}).click();
    await expect(page.locator(".status-bar .badge")).toHaveText("Ranked");

    const board= await solveOnPage(page);
    const [last]= await fillCells(page, board, {leave: 1});

    await context.setOffline(true);
    await selectCell(page, last);
    await page.keyboard.press(String(board.solution[last]));
    await expect(page.locator("#message")).toContainText("your time will be sent when you're back online");

    await context.setOffline(false);
    await expect(page.getByRole("dialog", {name: "Solved!"})).toContainText(/You are #\d+ on the \w+ leaderboard/);
  });
});
