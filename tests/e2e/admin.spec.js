import { test, expect } from "@playwright/test";
import { openGame, register, uniqueName, makeAdmin, solveOnPage, fillCells } from "./helpers.js";

/** A logged in admin, on the dashboard. */
const openDashboard= async (page, hash= "")=> {
  const username= uniqueName("admin");
  await openGame(page);
  await register(page, username);
  makeAdmin(username);
  await page.goto(`/admin.html${hash}`);
  await expect(page.locator("dashboard-option")).toHaveCount(6);
  return username;
};

test.describe("admin dashboard", ()=> {
  test("is for admins only", async ({page})=> {
    await page.goto("/admin.html");
    await expect(page.getByRole("heading", {name: "Admins only"})).toBeVisible();

    await openGame(page);
    await register(page, uniqueName("nosy"));
    await page.goto("/admin.html");
    await expect(page.getByRole("heading", {name: "Admins only"})).toBeVisible();
    await expect(page.locator("dashboard-option")).toHaveCount(0);
  });

  test("an admin reviews a battle report and bans the cheater", async ({page, browser})=> {
    // a battle where the "cheater" fills the grid at once, then the other player reports them
    const players= [];
    for (const prefix of ["cheat", "victim"]){
      const context= await browser.newContext();
      const playerPage= await context.newPage();
      const username= uniqueName(prefix);
      await openGame(playerPage);
      await register(playerPage, username);
      await playerPage.getByRole("tab", {name: "Battle"}).click();
      await playerPage.getByRole("button", {name: "Find opponent"}).click();
      players.push({context, page: playerPage, username});
    }
    const [cheater, victim]= players;
    await expect(cheater.page.locator(".board-overlay")).toBeHidden({timeout: 10_000});
    await fillCells(cheater.page, await solveOnPage(cheater.page));
    const defeat= victim.page.getByRole("dialog", {name: "Defeat"});
    await defeat.getByRole("button", {name: "Report opponent"}).click();
    await victim.page.getByRole("dialog", {name: `Report ${cheater.username}`}).getByRole("button", {name: "Send report"}).click();
    await expect(victim.page.getByText("an admin will look at the report")).toBeVisible();

    // the admin finds it from the stats
    await openDashboard(page);
    await page.getByRole("button", {name: /Open reports/}).click();
    await expect(page.getByRole("heading", {name: "Reports", exact: true})).toBeVisible();
    await page.locator(".dataTable tbody tr", {hasText: cheater.username}).getByRole("button", {name: "Review"}).click();

    await expect(page.getByRole("heading", {name: new RegExp(`Report #\\d+: ${cheater.username}`)})).toBeVisible();
    await expect(page.locator(".signals")).toContainText("No mistake and no correction at all");
    await expect(page.getByRole("img", {name: "Correct cells over time"})).toBeVisible();
    await page.getByRole("button", {name: "Show as table"}).last().click();
    await expect(page.locator(".chartTable table")).toBeVisible();

    await page.getByPlaceholder(/Note for the other admins/).fill("Bot");
    await page.getByRole("button", {name: `Ban ${cheater.username}`}).click();
    await page.getByRole("dialog", {name: `Ban ${cheater.username}?`}).getByRole("button", {name: "Ban"}).click();
    const reportPanel= page.locator(".dashboardPanel", {has: page.getByRole("heading", {name: "Report", exact: true})});
    await expect(reportPanel.locator(".badge")).toHaveText("Banned");
    await expect(page.locator(".dashboardPanel", {hasText: `Player: ${cheater.username}`}).locator(".panelHeader .badge")).toHaveText("Banned");

    // the cheater is logged out and can't log in
    await cheater.page.reload();
    await expect(cheater.page.locator(".account-label")).toHaveText("Log in");
    await cheater.page.locator(".account-button").click();
    await cheater.page.locator("input[name=username]").fill(cheater.username);
    await cheater.page.locator("input[name=password]").fill("secret123");
    await cheater.page.locator(".account-form button[type=submit]").click();
    await expect(cheater.page.getByRole("alert")).toHaveText("This account is suspended: Bot");

    await cheater.context.close();
    await victim.context.close();
  });

  test("an admin manages the users", async ({page, browser})=> {
    const playerContext= await browser.newContext();
    const playerPage= await playerContext.newPage();
    const player= uniqueName("helper");
    await openGame(playerPage);
    await register(playerPage, player);

    await openDashboard(page, "#users");
    await page.getByPlaceholder("Search a username…").fill(player);
    const row= page.locator(".dataTable tbody tr", {hasText: player});
    await expect(page.locator(".dataTable tbody tr")).toHaveCount(1);

    await row.getByRole("button", {name: "Make admin"}).click();
    await page.getByRole("dialog", {name: `Make ${player} an admin?`}).getByRole("button", {name: "Make admin"}).click();
    await expect(row.locator(".badge")).toHaveText("Admin");

    await playerPage.goto("/admin.html");
    await expect(playerPage.locator("dashboard-option")).toHaveCount(6);
    await playerContext.close();
  });

  test("the sidebar remembers the page and its state, links open a page", async ({page})=> {
    await openDashboard(page);
    await page.getByRole("button", {name: "Battles"}).click();
    await expect(page.getByRole("heading", {name: "Battles", exact: true})).toBeVisible();

    await page.getByRole("button", {name: "Collapse the sidebar"}).click();
    await expect(page.locator("#dashboardSidebar")).toHaveClass(/collapsed/);

    await page.reload();
    await expect(page.locator("dashboard-option#battles")).toHaveAttribute("aria-current", "page");
    await expect(page.locator("#dashboardSidebar")).toHaveClass(/collapsed/);

    await page.goto("/admin.html#system");
    await expect(page.getByRole("heading", {name: "System", exact: true})).toBeVisible();
    await expect(page.getByText("Uptime")).toBeVisible();
    await expect(page.getByText("Worker running")).toBeVisible();
  });

  test("stats and the activity chart", async ({page})=> {
    await openDashboard(page, "#stats");
    await expect(page.locator(".statTile", {hasText: "Players"})).toBeVisible();
    const chart= page.getByRole("img", {name: "Activity per day"});
    await expect(chart).toBeVisible();

    await page.getByRole("radio", {name: "Last week"}).click();
    await page.getByRole("button", {name: "Show as table"}).click();
    await expect(page.locator(".chartTable tbody tr")).toHaveCount(7);

    // hovering shows the values of the day
    const box= await page.locator(".chartOverlay").boundingBox();
    await page.mouse.move(box.x + box.width - 5, box.y + box.height / 2);
    await expect(page.locator(".chartTooltip")).toContainText("Solo games");
  });

  test("on a phone the pages are in a menu", async ({page})=> {
    await page.setViewportSize({width: 390, height: 844});
    await openDashboard(page);
    const menu= page.getByRole("button", {name: "Pages"});
    await expect(menu).toBeVisible();
    await expect(page.getByRole("button", {name: "Users"})).toBeHidden();

    await menu.click();
    await page.getByRole("button", {name: "Users"}).click();
    await expect(page.getByRole("heading", {name: "Users", exact: true})).toBeVisible();
    await expect(page.getByRole("button", {name: "Users"})).toBeHidden();

    const overflow= await page.evaluate(()=> document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
