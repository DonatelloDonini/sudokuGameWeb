import { test, expect } from "@playwright/test";
import { openGame, solveOnPage, fillCells, selectCell, cell } from "./helpers.js";

test.describe("solo game", ()=> {
  test.beforeEach(async ({page})=> {
    await openGame(page);
  });

  test("a whole game: numbers, conflicts, undo and victory", async ({page})=> {
    const board= await solveOnPage(page);
    const empty= board.puzzle.flatMap((value, index)=> value=== null ? [index] : []);

    // a number already in the row is a conflict, and undo takes it back
    const [first]= empty;
    const row= Math.floor(first / 9);
    const repeated= board.puzzle.slice(row * 9, row * 9 + 9).find(value=> value!== null);
    await selectCell(page, first);
    await page.keyboard.press(String(repeated));
    await expect(cell(page, first)).toHaveClass(/conflict/);
    await page.keyboard.press("Control+z");
    await expect(cell(page, first)).not.toHaveClass(/conflict/);
    await expect(cell(page, first).locator(".value")).toHaveText("");

    // everything but the last cell with the keyboard, the last one with the number pad
    const [last]= await fillCells(page, board, {leave: 1});
    await selectCell(page, last);
    await page.locator(".number-key").nth(board.solution[last] - 1).click();

    const victory= page.getByRole("dialog", {name: "Solved!"});
    await expect(victory).toBeVisible();
    await expect(victory).toContainText("Hardest technique needed");
    await expect(page.locator(".sudoku-board")).toHaveClass(/read-only/);

    await victory.getByRole("button", {name: "New game"}).click();
    await expect(victory).toBeHidden();
    await expect(page.locator(".sudoku-board")).not.toHaveClass(/read-only/);
  });

  test("pencil notes", async ({page})=> {
    const {puzzle}= await solveOnPage(page);
    const row= puzzle.findIndex((_, index)=> index % 9=== 0 && puzzle.slice(index, index + 9).filter(value=> value=== null).length>= 2);
    const [noted, other]= puzzle.slice(row, row + 9).flatMap((value, i)=> value=== null ? [row + i] : []);

    await selectCell(page, noted);
    const pencil= page.locator(".control-button", {hasText: "Pencil"});
    await pencil.click();
    await expect(pencil).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("1");
    await page.keyboard.press("2");
    await page.keyboard.press("2");
    await expect(cell(page, noted).locator(".note:not(:empty)")).toHaveText(["1"]);

    // Shift + number writes a note without the pencil
    await pencil.click();
    await page.keyboard.press("Shift+Digit2");
    await expect(cell(page, noted).locator(".note:not(:empty)")).toHaveText(["1", "2"]);

    // placing a 2 in the same row removes the note
    await selectCell(page, other);
    await page.keyboard.press("2");
    await expect(cell(page, noted).locator(".note:not(:empty)")).toHaveText(["1"]);
  });

  test("hint and solution", async ({page})=> {
    await page.locator(".control-button", {hasText: "Hint"}).click();
    await expect(page.locator(".cell.hinted")).toHaveCount(1);
    await expect(page.locator("#message")).toContainText("Hint:");
    await expect(page.locator(".status-bar .clock")).toHaveText(/^0:3\d$/);

    await page.locator(".control-button", {hasText: "Solution"}).click();
    const confirm= page.getByRole("dialog", {name: "Show the solution?"});
    await confirm.getByRole("button", {name: "Show solution"}).click();

    await expect(page.locator(".cell.revealed").first()).toBeVisible();
    await expect(page.locator(".cell .value:empty")).toHaveCount(0);
    await expect(page.locator(".control-button", {hasText: "Hint"})).toBeDisabled();
    await expect(page.locator(".status-bar .clock")).toHaveText("--:--");
  });

  test("the game survives a reload", async ({page})=> {
    const board= await solveOnPage(page);
    const index= board.puzzle.indexOf(null);
    await selectCell(page, index);
    await page.keyboard.press(String(board.solution[index]));

    await page.reload();
    await expect(cell(page, index).locator(".value")).toHaveText(String(board.solution[index]));
  });

  test("changing the difficulty starts a new game", async ({page})=> {
    const before= await solveOnPage(page);
    await page.locator(".status-bar select").selectOption("hard");
    await expect(page.locator(".status-bar select")).toHaveValue("hard");
    await expect.poll(async ()=> JSON.stringify((await solveOnPage(page)).puzzle)).not.toBe(JSON.stringify(before.puzzle));

    await page.reload();
    await expect(page.locator(".status-bar select")).toHaveValue("hard");
  });

  test("the keyboard moves the selection", async ({page})=> {
    await selectCell(page, 0);
    await page.keyboard.press("ArrowRight");
    await expect(cell(page, 1)).toHaveClass(/selected/);
    await page.keyboard.press("ArrowUp");
    await expect(cell(page, 73)).toHaveClass(/selected/);
    await page.keyboard.press("Escape");
    await expect(page.locator(".cell.selected")).toHaveCount(0);
  });
});
