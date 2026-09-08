import { test, expect } from "@playwright/test";
import { WC_API } from "./helpers/api";

interface Row { id: string; title: string; hasTiming?: boolean; fileUrls?: Record<string, string> }
interface Word { t: number; text: string }

let PATH = "";
let SONG: { songKey: string; bpm: number; publishedKeys?: string[]; form?: { defaultOrder: string[] } | null } = { songKey: "", bpm: 0 };
let LINES: string[] = [];
let LABELS: string[] = [];

test.beforeAll(async ({ request }) => {
  const rows: Row[] = await (await request.get(`${WC_API}/songs`)).json();
  const timed = (r: Row) => (r.hasTiming || r.fileUrls?.timing) && r.fileUrls?.midi;
  const row = rows.find(r => r.title === "Abide, O Dearest Jesus" && timed(r)) || rows.find(timed);
  if (!row) throw new Error("No seeded song with timing + midi");
  PATH = `/songs/${row.id}/lead`;
  SONG = await (await request.get(`${WC_API}/songs/${row.id}`)).json();
  const timing = await (await request.get((SONG as any).fileUrls.timing)).json();
  LINES = timing.stanzas[0].lines.map((l: Word[]) => l.map(w => w.text).join(" "));
  LABELS = timing.stanzas.map((s: { label: string }) => s.label);
});

// the person at the laptop needs no account
test.describe("lead worship player", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("renders the first line signed-out with the next line dimmed below it", async ({ page }) => {
    await page.goto(PATH);
    await expect(page.getByTestId("lead-worship")).toBeVisible();
    await expect(page.getByTestId("lead-stanza")).toHaveText(LABELS[0]);
    await expect(page.getByTestId("lead-line")).toHaveText(LINES[0]);
    await expect(page.getByTestId("lead-next")).toContainText(LINES[1]);
    await expect(page.getByTestId("lead-audio-label")).toHaveText("Preview (synthesized)");
    await expect(page.locator("header nav")).toHaveCount(0);
  });

  test("Space starts playback with zero console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
    page.on("pageerror", e => errors.push(e.message));

    await page.goto(PATH);
    const play = page.getByTestId("lead-play");
    await expect(play).toBeEnabled({ timeout: 30000 });
    await page.keyboard.press("Space");
    // count-in is on by default: one bar of clicks, then the tune
    await expect(play).toHaveText("Counting in…");
    await expect(play).toHaveText("❚❚ Pause", { timeout: 15000 });
    await page.keyboard.press("Space");
    await expect(play).toHaveText("▶ Play");
    expect(errors).toEqual([]);
  });

  test("→ advances the line while paused", async ({ page }) => {
    await page.goto(PATH);
    await expect(page.getByTestId("lead-line")).toHaveText(LINES[0]);
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("lead-line")).toHaveText(LINES[1]);
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByTestId("lead-line")).toHaveText(LINES[0]);
    await page.keyboard.press("ArrowDown");
    await expect(page.getByTestId("lead-stanza")).toHaveText(LABELS[1]);
  });

  test("B blanks the screen and brings it back", async ({ page }) => {
    await page.goto(PATH);
    await expect(page.getByTestId("lead-line")).toBeVisible();
    await page.keyboard.press("b");
    await expect(page.getByTestId("lead-blank-screen")).toBeVisible();
    await page.keyboard.press("b");
    await expect(page.getByTestId("lead-blank-screen")).toHaveCount(0);
    await page.getByTestId("lead-blank").click();
    await expect(page.getByTestId("lead-blank-screen")).toBeVisible();
  });

  test("key select lists the published keys first and everything else as preview", async ({ page }) => {
    await page.goto(PATH);
    const groups = page.locator("#lead-key optgroup");
    await expect(groups).toHaveCount(2);
    const published = SONG.publishedKeys?.length ? SONG.publishedKeys : [SONG.songKey];
    await expect(groups.first().locator("option")).toHaveCount(published.length);
    for (const k of published) await expect(groups.first().locator(`option[value="${k}"]`)).toHaveCount(1);
    await expect(groups.nth(1)).toHaveAttribute("label", /preview/i);
    await expect(page.getByTestId("lead-key")).toHaveValue(SONG.songKey);
  });

  test("verse picker unchecking a stanza removes it from the run order", async ({ page }) => {
    await page.goto(PATH);
    await page.getByTestId("lead-verses").click();
    const picker = page.getByTestId("verse-picker");
    await expect(picker).toBeVisible();
    const order = SONG.form?.defaultOrder?.length ? SONG.form.defaultOrder : LABELS;
    await expect(picker.locator("li label")).toHaveCount(order.length);
    const items = page.locator("[data-testid=run-order] li");
    await expect(items.first()).toHaveText(order[0]);
    const before = await items.count();
    await picker.locator("li label input").first().uncheck();
    await expect(items).toHaveCount(before - 1);
    await expect(items.first()).not.toHaveText(order[0]);
    // the pointer moves to the new top of the run
    await expect(page.getByTestId("lead-stanza")).toHaveText((await items.first().textContent()) || "");
  });

  test("tempo change updates the BPM readout", async ({ page }) => {
    await page.goto(PATH);
    await expect(page.getByTestId("lead-bpm")).toHaveText(`${SONG.bpm} BPM`);
    await page.getByTestId("lead-tempo").fill("150");
    await expect(page.getByTestId("lead-bpm")).toHaveText(`${Math.round(SONG.bpm * 1.5)} BPM`);
  });

  test("?key=A preselects A", async ({ page }) => {
    await page.goto(PATH + "?key=A");
    await expect(page.getByTestId("lead-key")).toHaveValue("A");
  });

  test("H toggles high contrast and the TV help opens", async ({ page }) => {
    await page.goto(PATH);
    await page.keyboard.press("h");
    await expect(page.getByTestId("lead-worship")).toHaveClass(/hc/);
    await page.getByTestId("lead-tv-help").click();
    await expect(page.getByTestId("tv-help")).toContainText("HDMI");
  });
});
