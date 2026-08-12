import { test, expect } from "@playwright/test";
import { songIdByTitle } from "./helpers/api";

let AMAZING_GRACE = "";
let ADESTE = "";

test.beforeAll(async ({ request }) => {
  AMAZING_GRACE = await songIdByTitle(request, "Amazing Grace");
  ADESTE = await songIdByTitle(request, "Adeste Fideles");
});

test.describe("sheet music", () => {
  test("song page links to the engraved score and ABC download", async ({ page }) => {
    await page.goto(`/songs/${AMAZING_GRACE}`);
    await expect(page.getByTestId("sheet-music-link")).toBeVisible();
    await expect(page.locator(`a[href$="tune.abc"]`)).toBeVisible();
  });

  test("renders the full score with lyrics and transposes", async ({ page }) => {
    await page.goto(`/songs/${AMAZING_GRACE}/sheet`);
    const paper = page.getByTestId("sheet-paper");
    await expect(paper.locator("svg")).toBeVisible();
    // lyrics engrave syllable-by-syllable, so assert on a one-syllable word
    await expect(paper).toContainText("wretch");

    await page.getByTestId("sheet-key").selectOption("A");
    await expect(paper.locator("svg")).toBeVisible();
  });

  test("solos a single part", async ({ page }) => {
    await page.goto(`/songs/${AMAZING_GRACE}/sheet`);
    const paper = page.getByTestId("sheet-paper");
    await expect(paper.locator("svg")).toBeVisible();
    const fullStaffLines = await paper.locator("svg path").count();

    await page.getByTestId("sheet-part").selectOption({ label: "Bass" });
    await expect(paper.locator("svg")).toBeVisible();
    // a single voice engraves far less ink than the four-part score
    await expect(async () => {
      expect(await paper.locator("svg path").count()).toBeLessThan(fullStaffLines);
    }).toPass();
  });

  test("borrowed tune shows music without words", async ({ page }) => {
    await page.goto(`/songs/${ADESTE}/sheet`);
    const paper = page.getByTestId("sheet-paper");
    await expect(paper.locator("svg")).toBeVisible();
    await expect(page.getByText("shared tune")).toBeVisible();
    // one-syllable lyric word absent from the rendered title/credits
    await expect(paper).not.toContainText("choirs");
  });
});

test.describe("chordpro preview", () => {
  test("upload form previews the chart live", async ({ page }) => {
    await page.goto("/upload");
    await page.fill("#title", "Preview Test");
    await page.fill("#lyrics", "Verse 1\n[G]Amazing [C]words");
    const preview = page.getByTestId("chordpro-preview");
    await expect(preview.locator(".stanza-label")).toHaveText("Verse 1");
    await expect(preview.locator(".seg .c").first()).toHaveText("G");
  });
});
