import { test, expect } from "@playwright/test";
import { WC_API, songIdByTitle } from "./helpers/api";

let AMAZING_GRACE = "";
let SILENT_NIGHT = "";
let ABIDE = "";
let BARE_SONG = "";

test.beforeAll(async ({ request }) => {
  AMAZING_GRACE = `/songs/${await songIdByTitle(request, "Amazing Grace")}`;
  SILENT_NIGHT = `/songs/${await songIdByTitle(request, "Silent Night")}`;
  ABIDE = `/songs/${await songIdByTitle(request, "Abide, O Dearest Jesus")}`;
  const list = await (await request.get(`${WC_API}/songs`)).json();
  const bare = list.find((s: { midiUrl?: string; lyricsUrl?: string; demoAudioUrl?: string }) => !s.midiUrl && !s.lyricsUrl && !s.demoAudioUrl);
  if (!bare) throw new Error("No seeded song without media found");
  BARE_SONG = `/songs/${bare.id}`;
});

test.describe("song page", () => {
  test("renders the chart with stanzas and metadata", async ({ page }) => {
    await page.goto(AMAZING_GRACE);
    await expect(page.getByRole("heading", { name: "Amazing Grace" })).toBeVisible();
    await expect(page.locator(".byline")).toContainText("John Newton · 1779");
    for (const label of ["Verse 1", "Verse 2"]) {
      await expect(page.locator(".stanza-label", { hasText: label })).toBeVisible();
    }
    await expect(page.locator("#key-label")).toHaveText("G");
    await expect(page.locator(".sheet .pd-badge")).toContainText("Public domain");
    await expect(page.locator(".license-note")).toContainText("Public domain");
    await expect(page.locator(".license-note")).toContainText("Free for churches");
    await expect(page.locator(".license-note")).not.toContainText("anywhere");
    await expect(page.locator(".license-note")).not.toContainText("worldwide");
  });

  test("transposes chords to any key", async ({ page }) => {
    await page.goto(AMAZING_GRACE);
    const firstChord = page.locator(".stanza .seg .c").first();
    await expect(firstChord).toHaveText("G");

    await page.selectOption("#transpose", "A");
    await expect(firstChord).toHaveText("A");
    await expect(page.locator("#key-label")).toHaveText("A");
    // Em (relative minor) moves with the key: G->A means Em->F#m
    await expect(page.locator(".stanza .seg .c", { hasText: "F#m" }).first()).toBeVisible();

    await page.selectOption("#transpose", "Bb");
    await expect(firstChord).toHaveText("Bb");
  });

  test("show-chords toggle hides the chord line", async ({ page }) => {
    await page.goto(AMAZING_GRACE);
    const firstChord = page.locator(".stanza .seg .c").first();
    await expect(firstChord).toBeVisible();
    await page.uncheck("#chords-toggle");
    await expect(firstChord).toBeHidden();
    await page.check("#chords-toggle");
    await expect(firstChord).toBeVisible();
  });

  test("chordpro and lyrics downloads carry real content", async ({ page }) => {
    const cho = await page.request.get(`${WC_API}${AMAZING_GRACE}/chordpro`);
    expect(cho.ok()).toBeTruthy();
    const choText = await cho.text();
    expect(choText).toContain("{title: Amazing Grace}");
    expect(choText).toContain("[G]Amazing grace! how [C]sweet the [G]sound,");

    const lyr = await page.request.get(`${WC_API}${AMAZING_GRACE}/lyrics`);
    const lyrText = await lyr.text();
    expect(lyrText).toContain("Amazing grace! how sweet the sound,");
    expect(lyrText).not.toContain("[");
  });

  test("real translations link both ways through the commons", async ({ page }) => {
    await page.goto(SILENT_NIGHT);
    await expect(page.getByTestId("demo-audio")).toHaveCount(0);
    await expect(page.locator(".mt-zip")).toHaveCount(0);
    await expect(page.locator(".rel-list a", { hasText: "Stille Nacht" })).toBeVisible();
    await expect(page.locator(".rel-list a", { hasText: "Noche de Paz" })).toBeVisible();

    await page.locator(".rel-list a", { hasText: "Stille Nacht" }).click();
    await expect(page.getByRole("heading", { name: "Stille Nacht" })).toBeVisible();
    await expect(page.locator(".rel-list a", { hasText: "Silent Night" })).toBeVisible();
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

  test("tempo control and karaoke sing-along on a timed hymn", async ({ page }) => {
    await page.goto(ABIDE);
    await expect(page.locator("#tempo")).toBeVisible();
    await expect(page.locator(".tempo-val").first()).toContainText("BPM");

    const sing = page.getByTestId("sing-along");
    await expect(sing).toBeVisible();
    await sing.click();
    await expect(page.getByTestId("karaoke")).toBeVisible();
    // lyrics come from lyrics.json and render without waiting on audio
    await expect(page.locator(".karaoke-line").first()).toContainText("Abide, O dearest Jesus");
    await page.getByTestId("karaoke-close").click();
    await expect(page.getByTestId("karaoke")).toHaveCount(0);
  });

  test("voice parts are detected from the midi and selectable", async ({ page }) => {
    await page.goto(ABIDE);
    const parts = page.getByTestId("parts");
    await expect(parts).toBeVisible();
    await expect(parts.locator(".part-btn")).toHaveText(["All", "Soprano", "Alto", "Tenor", "Bass"]);
    await expect(parts.locator(".part-btn.on")).toHaveText("All");
    await parts.getByRole("button", { name: "Tenor" }).click();
    await expect(parts.locator(".part-btn.on")).toHaveText("Tenor");
  });

  test("songs without timing data get no sing-along button", async ({ page }) => {
    await page.goto(BARE_SONG);
    await expect(page.locator(".song-title")).toBeVisible();
    await expect(page.getByTestId("piano-play")).toHaveCount(0);
    await expect(page.getByTestId("sing-along")).toHaveCount(0);
  });

  test("print chart renders a printable page in the chosen key", async ({ page }) => {
    await page.goto(AMAZING_GRACE + "/print");
    await expect(page.getByRole("heading", { name: "Amazing Grace" })).toBeVisible();
    // lyric lines are split across chord segments — match within one segment
    await expect(page.getByText("sweet the").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Print" })).toBeVisible();
    await expect(page.locator(".print-chord").first()).toHaveText("G");

    // ?key= transposes the printed chart
    await page.goto(AMAZING_GRACE + "/print?key=A");
    await expect(page.getByText("Key of A")).toBeVisible();
    await expect(page.locator(".print-chord").first()).toHaveText("A");
  });
});
