import { test, expect, Page } from "@playwright/test";
import * as fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// the same vocabulary the app bundles, read from the vendored copy
const THEMES: string[] = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "src", "themes.json"), "utf8")).themes;

// The library, the submit form and the home chips all draw on the one controlled
// vocabulary (themes.json, vendored from WorshipCommonsContent). These specs prove the
// legacy free-form values are gone and the vocabulary is what a leader actually sees.

// the site language pre-filters the library — clear it to face the whole catalog
async function openLibrary(page: Page) {
  await page.goto("/songs");
  await page.getByLabel("Language", { exact: true }).selectOption("");
  await expect(page.getByTestId("theme-facet")).toBeVisible();
}

test.describe("theme vocabulary", () => {
  test("the library facet is the vocabulary, in vocabulary order", async ({ page }) => {
    await openLibrary(page);
    await page.getByRole("button", { name: "Show more" }).click();

    const facet = page.getByTestId("theme-facet");
    const labels = (await facet.locator("li label").allInnerTexts())
      .map(s => s.replace(/\s+[\d,]+\s*$/, "").trim());

    expect(labels.length).toBeGreaterThan(5);
    // the collisions the vocabulary exists to fix
    expect(labels).not.toContain("Christmas/Advent");
    expect(labels).not.toContain("Closing Songs");
    expect(labels).not.toContain("Children");
    expect(labels).toContain("Advent");
    expect(labels).toContain("Christmas");
    expect(labels).toContain("Kids");
    // nothing outside the vocabulary survived normalization
    for (const label of labels) expect(THEMES).toContain(label);
    // and what is shown follows the vocabulary's own order
    expect(labels).toEqual([...labels].sort((a, b) => THEMES.indexOf(a) - THEMES.indexOf(b)));
  });

  test("the submit form offers the vocabulary and no free-text themes", async ({ page }) => {
    await page.goto("/upload");
    const chips = page.getByTestId("theme-chips");
    await expect(chips.getByRole("button", { name: "Sending", exact: true })).toBeVisible();
    await expect(chips.getByRole("button", { name: "Kids", exact: true })).toBeVisible();
    await expect(chips.getByRole("button")).toHaveCount(THEMES.length);
    await expect(page.locator("input#themes")).toHaveCount(0);

    await chips.getByRole("button", { name: "Sending", exact: true }).click();
    await expect(chips.getByRole("button", { name: "Sending", exact: true })).toHaveAttribute("aria-pressed", "true");
  });

  test("the home kids link filters the library to Kids", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("kids-chip").click();
    await expect(page).toHaveURL(/theme=Kids/);
    await expect(page.locator("#active-chips .active-chip", { hasText: "Kids" })).toBeVisible();
    await expect(page.locator(".t-row", { hasText: "Jesus Loves Me" })).toBeVisible();
    // every row on a Kids-filtered library carries the Kids theme
    const rows = page.locator(".t-row");
    expect(await rows.count()).toBeGreaterThan(0);
    for (const themes of await rows.locator(".t-themes").allInnerTexts()) expect(themes).toContain("Kids");
  });
});
