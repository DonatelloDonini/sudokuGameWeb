import { test, expect } from "@playwright/test";
import { openGame, register, uniqueName } from "./helpers.js";

test.describe("avatars", ()=> {
  test("a player builds an avatar, which is saved and shown everywhere", async ({page})=> {
    const username= uniqueName("artist");
    await openGame(page);
    await register(page, username);

    // a face from the start, always the same for a username
    const accountAvatar= page.locator(".account-button .avatar-image svg");
    await expect(accountAvatar).toBeVisible();
    const before= await accountAvatar.innerHTML();

    await page.locator(".account-button").click();
    await page.getByRole("button", {name: "Edit avatar"}).click();
    const dialog= page.getByRole("dialog", {name: "Your avatar"});
    await dialog.getByRole("tab", {name: "Hair", exact: true}).click();
    await dialog.getByRole("button", {name: "Afro"}).click();
    await dialog.getByRole("tab", {name: "Hat"}).click();
    await dialog.getByRole("button", {name: "Crown"}).click();
    await dialog.getByRole("button", {name: "Save"}).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByRole("dialog", {name: "Account"}).locator(".profile-header .avatar-image")).toBeVisible();
    await expect.poll(()=> accountAvatar.innerHTML()).not.toBe(before);
    const after= await accountAvatar.innerHTML();

    // kept after a reload, so stored on the server
    await page.reload();
    await expect(accountAvatar).toBeVisible();
    expect(await accountAvatar.innerHTML()).toBe(after);
  });

  test("cancelling the editor keeps the avatar", async ({page})=> {
    await openGame(page);
    await register(page, uniqueName("undecided"));
    const accountAvatar= page.locator(".account-button .avatar-image svg");
    const before= await accountAvatar.innerHTML();

    await page.locator(".account-button").click();
    await page.getByRole("button", {name: "Edit avatar"}).click();
    const dialog= page.getByRole("dialog", {name: "Your avatar"});
    await dialog.getByRole("button", {name: "Randomize"}).click();
    await dialog.getByRole("button", {name: "Cancel"}).click();

    expect(await accountAvatar.innerHTML()).toBe(before);
  });
});
