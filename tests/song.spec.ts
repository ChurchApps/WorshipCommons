import { test, expect } from "@playwright/test";
import { WC_API, songIdByTitle } from "./helpers/api";

let EVERY_VALLEY = "";
let SILENT_NIGHT = "";

test.beforeAll(async ({ request }) => {
  EVERY_VALLEY = `/songs/${await songIdByTitle(request, "Every Valley")}`;
  SILENT_NIGHT = `/songs/${await songIdByTitle(request, "Silent Night")}`;
});

test.describe("song page", () => {
  test("renders the chart with stanzas and metadata", async ({ page }) => {
    await page.goto(EVERY_VALLEY);
    await expect(page.getByRole("heading", { name: "Every Valley" })).toBeVisible();
    await expect(page.locator(".byline")).toContainText("Miriam Okafor · 2023");
    for (const label of ["Verse 1", "Chorus", "Verse 2", "Bridge"]) {
      await expect(page.locator(".stanza-label", { hasText: label })).toBeVisible();
    }
    await expect(page.locator("#key-label")).toHaveText("D");
    await expect(page.locator(".sheet .free-badge")).toContainText("Free for worship");
  });

  test("transposes chords to any key", async ({ page }) => {
    await page.goto(EVERY_VALLEY);
    const firstChord = page.locator(".stanza .seg .c").first();
    await expect(firstChord).toHaveText("D");

    await page.selectOption("#transpose", "E");
    await expect(firstChord).toHaveText("E");
    await expect(page.locator("#key-label")).toHaveText("E");
    // Bm (relative minor) moves with the key: D->E means Bm->C#m
    await expect(page.locator(".stanza .seg .c", { hasText: "C#m" }).first()).toBeVisible();

    await page.selectOption("#transpose", "Bb");
    await expect(firstChord).toHaveText("Bb");
  });

  test("show-chords toggle hides the chord line", async ({ page }) => {
    await page.goto(EVERY_VALLEY);
    const firstChord = page.locator(".stanza .seg .c").first();
    await expect(firstChord).toBeVisible();
    await page.uncheck("#chords-toggle");
    await expect(firstChord).toBeHidden();
    await page.check("#chords-toggle");
    await expect(firstChord).toBeVisible();
  });

  test("chordpro and lyrics downloads carry real content", async ({ page }) => {
    const cho = await page.request.get(`${WC_API}${EVERY_VALLEY}/chordpro`);
    expect(cho.ok()).toBeTruthy();
    const choText = await cho.text();
    expect(choText).toContain("{title: Every Valley}");
    expect(choText).toContain("[D]Every valley shall [G]be [D]lifted,");

    const lyr = await page.request.get(`${WC_API}${EVERY_VALLEY}/lyrics`);
    const lyrText = await lyr.text();
    expect(lyrText).toContain("Every valley shall be lifted,");
    expect(lyrText).not.toContain("[");
  });

  test("related songs appear, with no fabricated audio or stems", async ({ page }) => {
    await page.goto(EVERY_VALLEY);
    await expect(page.getByTestId("demo-audio")).toHaveCount(0);
    await expect(page.locator(".mt-zip")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Melody (MIDI)" })).toHaveCount(0);
    await expect(page.locator(".rel-list a", { hasText: "Todo Valle" })).toBeVisible();

    await page.locator(".rel-list a", { hasText: "Todo Valle" }).click();
    await expect(page.getByRole("heading", { name: "Todo Valle" })).toBeVisible();
    await expect(page.locator(".rel-list a", { hasText: "Every Valley" })).toBeVisible();
  });

  test("a seeded hymn renders with real lyrics and flat-key transposition", async ({ page }) => {
    await page.goto(SILENT_NIGHT);
    await expect(page.getByRole("heading", { name: "Silent Night" })).toBeVisible();
    await expect(page.getByText("all is calm,")).toBeVisible();
    const firstChord = page.locator(".stanza .seg .c").first();
    await expect(firstChord).toHaveText("Bb");
    await page.selectOption("#transpose", "C");
    await expect(firstChord).toHaveText("C");

    // real PD melody MIDI from the Open Hymnal import
    const midiLink = page.getByRole("link", { name: "Melody (MIDI)" });
    await expect(midiLink).toBeVisible();
    const midi = await page.request.get(await midiLink.getAttribute("href"));
    expect(midi.ok()).toBeTruthy();
    expect((await midi.body()).subarray(0, 4).toString()).toBe("MThd");
  });

  test("print chart renders a printable page", async ({ page }) => {
    await page.goto(EVERY_VALLEY + "/print");
    await expect(page.getByRole("heading", { name: "Every Valley" })).toBeVisible();
    // lyric lines are split across chord segments — match within one segment
    await expect(page.getByText("Prepare the").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Print" })).toBeVisible();
  });
});
