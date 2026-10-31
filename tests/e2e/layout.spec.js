import { test, expect } from "@playwright/test";
import { openGame } from "./helpers.js";

test.describe("layout", ()=> {
  test("the game fits the screen without errors", async ({page})=> {
    const errors= [];
    page.on("pageerror", (error)=> errors.push(error.message));
    await openGame(page);

    const viewport= page.viewportSize();
    const overflow= await page.evaluate(()=> document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    const board= await page.locator(".sudoku-board").boundingBox();
    expect(board.x).toBeGreaterThanOrEqual(0);
    expect(board.x + board.width).toBeLessThanOrEqual(viewport.width);
    expect(board.y + board.height).toBeLessThanOrEqual(viewport.height);
    expect(Math.abs(board.width - board.height)).toBeLessThan(2);

    await expect(page.locator(".number-key")).toHaveCount(9);
    expect(errors).toEqual([]);
  });

  test("the rules button is in the top right corner and opens the rules", async ({page})=> {
    await openGame(page);
    const rules= page.getByRole("button", {name: "Show the rules"});
    const box= await rules.boundingBox();
    const viewport= page.viewportSize();
    expect(viewport.width - (box.x + box.width)).toBeLessThan(32);
    expect(box.y).toBeLessThan(32);

    await rules.click();
    const dialog= page.getByRole("dialog", {name: "Rules"});
    await expect(dialog).toContainText("Pencil mode");
    await expect(dialog).toContainText("Difficulties");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("the API documentation works", async ({page})=> {
    await page.goto("/api.html");
    await expect(page.getByRole("heading", {name: "Sudoku API"})).toBeVisible();
    await page.locator("#try-form select[name=difficulty]").selectOption("easy");
    await page.getByRole("button", {name: "Get a puzzle"}).click();
    await expect(page.locator("#try-output")).toContainText("hardestTechnique");

    const overflow= await page.evaluate(()=> document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
