import { test, expect } from "@playwright/test";
import { openGame, register, uniqueName, solveOnPage, givensOnPage, fillCells } from "./helpers.js";

/**
 * Two logged in players, each in their own browser, on the battle tab.
 */
const twoPlayers= async (browser)=> {
  const players= [];
  for (const prefix of ["alpha", "bravo"]){
    const context= await browser.newContext();
    const page= await context.newPage();
    const username= uniqueName(prefix);
    await openGame(page);
    await register(page, username);
    await page.getByRole("tab", {name: "Battle"}).click();
    players.push({context, page, username});
  }
  return players;
};

const startBattle= async (a, b)=> {
  await a.page.getByRole("button", {name: "Find opponent"}).click();
  await b.page.getByRole("button", {name: "Find opponent"}).click();
  for (const {page} of [a, b]){
    await expect(page.locator(".versus")).toBeVisible();
    await expect(page.locator(".board-overlay")).toBeHidden({timeout: 8000});
  }
};

test.describe("battles", ()=> {
  test("guests are asked to log in", async ({page})=> {
    await openGame(page);
    await page.getByRole("tab", {name: "Battle"}).click();
    await expect(page.locator(".board-overlay")).toHaveText("Log in to battle");
    await expect(page.locator(".status-bar").getByRole("button", {name: "Log in"})).toBeVisible();
  });

  test("same puzzle at the same time, the first to solve it wins the elo", async ({browser})=> {
    const [alpha, bravo]= await twoPlayers(browser);

    await alpha.page.getByRole("button", {name: "Find opponent"}).click();
    await bravo.page.getByRole("button", {name: "Find opponent"}).click();
    await expect(alpha.page.locator(".board-overlay")).toHaveText(/^[1-3]$/);
    await expect(alpha.page.locator(".versus-names")).toHaveText(new RegExp(`${alpha.username} \\(1200\\) vs .*${bravo.username} \\(1200\\)`));
    await expect(alpha.page.getByRole("img", {name: `${bravo.username}'s avatar`})).toBeVisible();
    await expect(alpha.page.locator(".board-overlay")).toBeHidden({timeout: 8000});
    await expect(bravo.page.locator(".board-overlay")).toBeHidden({timeout: 8000});

    expect(await givensOnPage(alpha.page)).toEqual(await givensOnPage(bravo.page));
    const board= await solveOnPage(alpha.page);
    const emptyCells= board.puzzle.filter(value=> value=== null).length;

    // the opponent sees how many cells are filled
    await fillCells(bravo.page, board, {leave: emptyCells - 3});
    await expect(alpha.page.locator(".progress-track").nth(1)).toHaveAttribute("aria-valuenow", "3");

    await fillCells(alpha.page, board);
    const victory= alpha.page.getByRole("dialog", {name: "Victory!"});
    await expect(victory).toContainText("+16");
    const defeat= bravo.page.getByRole("dialog", {name: "Defeat"});
    await expect(defeat).toContainText("-16");
    await expect(alpha.page.locator(".account-label")).toHaveText(`${alpha.username} · 1216`);
    await expect(bravo.page.locator(".account-label")).toHaveText(`${bravo.username} · 1184`);

    // the loser reports the winner
    await defeat.getByRole("button", {name: "Report opponent"}).click();
    const report= bravo.page.getByRole("dialog", {name: `Report ${alpha.username}`});
    await expect(report).toContainText("move by move");
    await report.getByRole("button", {name: "Send report"}).click();
    await expect(report).toContainText("an admin will look at the report");

    await alpha.context.close();
    await bravo.context.close();
  });

  test("a reload doesn't lose the battle, resigning ends it", async ({browser})=> {
    const [alpha, bravo]= await twoPlayers(browser);
    await startBattle(alpha, bravo);

    const board= await solveOnPage(bravo.page);
    const emptyCells= board.puzzle.filter(value=> value=== null).length;
    await fillCells(bravo.page, board, {leave: emptyCells - 2});

    await bravo.page.reload();
    await expect(bravo.page.locator(".versus")).toBeVisible();
    await expect(bravo.page.locator(".cell:not(.given) .value:not(:empty)")).toHaveCount(2);
    await expect(alpha.page.locator("#message")).toHaveText("Your opponent is back.");

    await bravo.page.getByRole("button", {name: "Resign"}).click();
    await bravo.page.getByRole("dialog", {name: "Resign?"}).getByRole("button", {name: "Resign"}).click();
    await expect(alpha.page.getByRole("dialog", {name: "Victory!"})).toContainText(`${bravo.username} resigned.`);
    await expect(bravo.page.getByRole("dialog", {name: "Defeat"})).toContainText("You resigned.");

    await alpha.context.close();
    await bravo.context.close();
  });
});
