import { test, expect } from "@playwright/test";
import { songIdByTitle } from "./helpers/api";

test("Nashville numbers toggle swaps chord names for degrees", async ({ page, request }) => {
  await page.goto(`/songs/${await songIdByTitle(request, "Amazing Grace")}`);
  const chords = page.locator(".stanza .seg .c");
  await expect(chords.first()).toHaveText("G");

  await page.check("#nashville-toggle");
  await expect(chords.first()).toHaveText("1");
  // C is the 4, D7 the 57, Em the 6m — all relative to G
  await expect(chords.filter({ hasText: /^4$/ }).first()).toBeVisible();
  await expect(chords.filter({ hasText: /^6m$/ }).first()).toBeVisible();

  // numbers don't move when the key does
  await page.selectOption("#transpose", "A");
  await expect(chords.first()).toHaveText("1");
  await expect(page.locator("#key-label")).toHaveText("A");

  await page.uncheck("#nashville-toggle");
  await expect(chords.first()).toHaveText("A");
});
