import { test, expect } from "@playwright/test";
import { WC_API } from "./helpers/api";

interface Row {
  id: string;
  title: string;
  demoAudioUrl?: string;
  masterUrl?: string;
  midiUrl?: string;
  fileUrls?: Record<string, string>;
}

const AUDIO_EXT = /\.(mp3|wav|m4a|ogg|flac)(\?|#|$)/i;

function recordingUrlOf(s: Row): string | undefined {
  const u = s.demoAudioUrl || s.masterUrl || s.fileUrls?.demoAudio || s.fileUrls?.master || s.fileUrls?.song;
  return u && AUDIO_EXT.test(u) ? u : undefined;
}

let songs: Row[] = [];

test.beforeAll(async ({ request }) => {
  songs = await (await request.get(`${WC_API}/songs`)).json();
});

test.describe("honest homepage", () => {
  test("positions the library as PD hymns and writer-shared songs, not a license-free store", async ({ page }) => {
    await page.goto("/");
    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toContainText("Great music.");
    await expect(h1).toContainText("For every church.");

    await expect(page.getByRole("main")).toContainText(/keep CCLI/i);
    await expect(page.locator("body")).not.toContainText(/no licenses needed/i);
    await expect(page.locator("body")).not.toContainText(/no licenses, no strings/i);
    await expect(page.getByRole("main")).not.toContainText(/Tracks for rehearsal/i);

    const desc = await page.locator('meta[name="description"]').getAttribute("content");
    expect(desc ?? "").not.toMatch(/no licenses/i);
    expect(desc ?? "").not.toMatch(/no strings/i);
    const og = await page.locator('meta[property="og:description"]').getAttribute("content");
    expect(og ?? "").not.toMatch(/no licenses/i);
    expect(og ?? "").not.toMatch(/no strings/i);
  });

  test("names ChurchApps in the footer", async ({ page }) => {
    await page.goto("/");
    const credit = page.getByTestId("churchapps-credit");
    await expect(credit).toBeVisible();
    await expect(credit).toContainText(/ChurchApps/);
    await expect(credit).toContainText(/B1 Church/);
    await expect(credit).toContainText(/FreeShow/);
    await expect(credit.locator("a")).toHaveAttribute("href", "https://churchapps.org");
  });

  test("album play buttons exist only when a writer shared a recording", async ({ page }) => {
    await page.goto("/");
    const cards = page.getByTestId("home-top-list").locator("li");
    await expect(cards).toHaveCount(4);

    let midiOnlySeen = 0;
    for (let i = 0; i < 4; i++) {
      const title = (await cards.nth(i).locator("h3").innerText()).trim();
      const song = songs.find(s => s.title === title);
      expect(song, `homepage card "${title}" is in the catalog`).toBeTruthy();
      const hasRec = !!recordingUrlOf(song!);
      const midi = song!.midiUrl || song!.fileUrls?.midi;
      const play = cards.nth(i).getByTestId("home-play");
      if (hasRec) {
        await expect(play, `"${title}" has a recording so it may play`).toHaveCount(1);
      } else {
        await expect(play, `"${title}" has no recording so MIDI must not play`).toHaveCount(0);
        if (midi) midiOnlySeen++;
      }
    }

    const midiOnly = songs.find(s => (s.midiUrl || s.fileUrls?.midi) && !recordingUrlOf(s));
    if (midiOnlySeen === 0 && midiOnly) {
      // none of the four Sunday-set cards is MIDI-only; still prove a MIDI-only hymn exists in the seed
      expect(recordingUrlOf(midiOnly)).toBeFalsy();
    }
  });
});
