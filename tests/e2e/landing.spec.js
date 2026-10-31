import { test, expect } from "@playwright/test";

test.describe("landing page", ()=> {
  test("presents the game and leads to it", async ({page})=> {
    const errors= [];
    page.on("pageerror", (error)=> errors.push(error.message));
    await page.goto("/");

    await expect(page.getByRole("heading", {level: 1})).toBeVisible();
    await expect(page.getByRole("img", {name: /sudoku being solved/})).toBeVisible();
    await expect(page.locator(".hero-cell")).toHaveCount(81);

    const overflow= await page.evaluate(()=> document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    await page.getByRole("link", {name: "Play now"}).click();
    await expect(page).toHaveURL(/\/play\/$/);
    await expect(page.locator(".cell")).toHaveCount(81);
    expect(errors).toEqual([]);
  });

  test("the game has no documentation, its title leads back home", async ({page})=> {
    await page.goto("/play/");
    await expect(page.getByRole("link", {name: /developers/i})).toHaveCount(0);
    await page.getByRole("link", {name: "Sudoku"}).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("\"Find a rival\" opens the battles", async ({page})=> {
    await page.goto("/");
    await page.getByRole("link", {name: "Find a rival"}).click();
    await expect(page.getByRole("tab", {name: "Battle"})).toHaveAttribute("aria-selected", "true");
  });

  test("the developers area is linked from the landing page", async ({page})=> {
    await page.goto("/");
    const viewport= page.viewportSize();
    if (viewport.width<= 640) await page.getByRole("button", {name: "Menu"}).click();
    await page.getByRole("navigation", {name: "Site"}).getByRole("link", {name: "Developers"}).click();
    await expect(page.getByRole("heading", {name: "Sudoku for developers"})).toBeVisible();
    await expect(page.getByRole("navigation", {name: "Developers area"}).getByRole("link", {name: "Puzzles"})).toBeVisible();
  });
});
