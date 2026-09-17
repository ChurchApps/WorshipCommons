import { test, expect } from "@playwright/test";
import { WC_API } from "./helpers/api";

interface SeedSong {
  id: string;
  title: string;
  language: string;
  confidence?: string;
  songKey?: string;
  demoAudioUrl?: string;
  masterUrl?: string;
  fileUrls?: Record<string, string>;
}

const AUDIO = /\.(mp3|wav|m4a|ogg|flac)(\?|#|$)/i;
const recordingOf = (s: SeedSong) => {
  const u = s.demoAudioUrl || s.masterUrl || s.fileUrls?.demoAudio || s.fileUrls?.master || s.fileUrls?.song;
  return u && AUDIO.test(u) ? u : undefined;
};

let songs: SeedSong[] = [];

test.beforeAll(async ({ request }) => {
  songs = await (await request.get(`${WC_API}/songs`)).json();
});

const lyricsOnly = () =>
  songs.find(s => s.confidence === "lyrics-only" && s.language === "English")
  || songs.find(s => s.confidence === "lyrics-only");

test.describe("sunday-ready library default", () => {
  test("hides lyrics-only songs until hide-incomplete is turned off", async ({ page }) => {
    const song = lyricsOnly();
    expect(song, "seed has a lyrics-only song").toBeTruthy();

    // default language still applied — search so pagination cannot hide the row
    await page.goto("/songs");
    await expect(page.getByTestId("hide-incomplete")).toBeChecked();
    await expect(page.locator("#active-chips .active-chip", { hasText: "Hide incomplete" })).toBeVisible();
    await page.fill("#q", song!.title);
    await expect(page.locator(".t-row", { hasText: song!.title })).toHaveCount(0);

    await page.getByTestId("hide-incomplete").uncheck();
    await expect(page.locator(".t-row", { hasText: song!.title }).first()).toBeVisible();
  });

  test("?all=1 starts with the filter off and shows a lyrics-only song", async ({ page }) => {
    const song = lyricsOnly();
    expect(song, "seed has a lyrics-only song").toBeTruthy();

    await page.goto("/songs?all=1");
    await expect(page.getByTestId("hide-incomplete")).not.toBeChecked();
    await page.fill("#q", song!.title);
    await expect(page.locator(".t-row", { hasText: song!.title }).first()).toBeVisible();
  });

  test("clear all filters turns hide-incomplete off", async ({ page }) => {
    await page.goto("/songs");
    await expect(page.getByTestId("hide-incomplete")).toBeChecked();
    await page.getByRole("button", { name: "Clear all filters" }).click();
    await expect(page.getByTestId("hide-incomplete")).not.toBeChecked();
    await expect(page.locator("#active-chips .active-chip")).toHaveCount(0);
  });

  test("keep-ccli is visible on the library, not only the empty state", async ({ page }) => {
    await page.goto("/songs");
    await expect(page.getByTestId("keep-ccli")).toBeVisible();
    await expect(page.getByTestId("keep-ccli")).toContainText(/does not replace CCLI|SongSelect/i);
    await expect(page.locator(".t-row").first()).toBeVisible();
  });

  test("a row without a recording does not offer MIDI play", async ({ page }) => {
    const noRec = songs.find(s => !recordingOf(s) && s.language === "English" && s.confidence !== "lyrics-only" && !!(s.songKey || "").trim())
      || songs.find(s => !recordingOf(s));
    expect(noRec, "seed has a song without a recording").toBeTruthy();

    await page.goto("/songs?all=1");
    await page.getByLabel("Language", { exact: true }).selectOption("");
    await page.fill("#q", noRec!.title);
    const row = page.locator(".t-row", { hasText: noRec!.title }).first();
    await expect(row).toBeVisible();
    const play = row.locator(".play-btn");
    await expect(play).toHaveClass(/mute/);
    await expect(play).toHaveAttribute("aria-label", "No demo yet");
  });
});
