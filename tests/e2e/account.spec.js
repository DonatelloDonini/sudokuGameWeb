import { test, expect } from "@playwright/test";
import { openGame, register, uniqueName, solveOnPage, fillCells } from "./helpers.js";

test.describe("accounts and leaderboard", ()=> {
  test("register, log out and log in again", async ({page})=> {
    const username= uniqueName("player");
    await openGame(page);
    await expect(page.locator(".status-bar .badge")).toHaveText("Guest");

    await register(page, username);

    await page.locator(".account-button").click();
    const account= page.getByRole("dialog", {name: "Account"});
    await expect(account).toContainText(username);
    await account.getByRole("button", {name: "Log out"}).click();
    await expect(page.locator(".account-label")).toHaveText("Log in");

    await page.locator(".account-button").click();
    await page.locator("input[name=username]").fill(username);
    await page.locator("input[name=password]").fill("wrong-password");
    await page.locator(".account-form button[type=submit]").click();
    await expect(account).toContainText("Wrong username or password.");

    await page.locator("input[name=password]").fill("secret123");
    await page.locator(".account-form button[type=submit]").click();
    await expect(page.locator(".account-label")).toHaveText(new RegExp(`^${username}`));
  });

  test("taken usernames are refused", async ({page})=> {
    const username= uniqueName("taken");
    await openGame(page);
    await register(page, username);
    await page.locator(".account-button").click();
    await page.getByRole("button", {name: "Log out"}).click();

    await page.locator(".account-button").click();
    await page.getByRole("tab", {name: "Register"}).click();
    await page.locator("input[name=username]").fill(username);
    await page.locator("input[name=password]").fill("secret123");
    await page.locator(".account-form button[type=submit]").click();
    await expect(page.getByRole("alert")).toHaveText("This username is already taken.");
  });

  test("a ranked game goes on the leaderboard, where other players can report it", async ({page, browser})=> {
    const champion= uniqueName("champ");
    await openGame(page);
    await register(page, champion);
    await page.locator(".status-bar").getByRole("button", {name: "New game"}).click();
    await expect(page.locator(".status-bar .badge")).toHaveText("Ranked");

    await fillCells(page, await solveOnPage(page));
    const victory= page.getByRole("dialog", {name: "Solved!"});
    await expect(victory).toContainText(/You are #\d+ on the \w+ leaderboard/);
    await victory.getByRole("button", {name: "Leaderboard"}).click();
    await expect(page.locator(".leaderboard-table tr.current-user")).toContainText(champion);
    await expect(page.locator(".leaderboard-table tr.current-user").getByRole("img", {name: `${champion}'s avatar`})).toBeVisible();

    // another player reports the time
    const otherContext= await browser.newContext();
    const other= await otherContext.newPage();
    await openGame(other);
    await register(other, uniqueName("rival"));
    await other.locator(".status-bar select").selectOption(await page.locator(".status-bar select").inputValue());
    await other.getByRole("button", {name: "Show the leaderboard"}).click();
    await other.getByRole("button", {name: `Report ${champion} for cheating`}).click();

    const report= other.getByRole("dialog", {name: `Report ${champion}`});
    await report.getByLabel("Impossible time").check();
    await report.locator("textarea").fill("Way too fast for this difficulty.");
    await report.getByRole("button", {name: "Send report"}).click();
    await expect(report).toContainText("an admin will look at the report");
    await otherContext.close();
  });
});
