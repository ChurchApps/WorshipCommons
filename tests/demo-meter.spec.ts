import { test, expect, Page } from "@playwright/test";
import { WC_API } from "./helpers/api";

interface SeedSong { id: string; title: string; meter?: string; language: string; scripture: string; themes: string; license: string; downloadCount: number; parentSongId?: string; }

// expectations are computed from the live seed so the catalog can grow without breaking the spec
let songs: SeedSong[] = [];
let subject: SeedSong;
let expectedSimilar: SeedSong[] = [];

const themesOf = (s: SeedSong) => (s.themes || "").split(",").map(t => t.trim()).filter(Boolean);
const bookOf = (s: SeedSong) => (s.scripture || "").replace(/\s+\d+.*$/, "").trim();

// mirrors SongPage: same language, +2 same meter, +2 same scripture book, +1 per shared theme, top 4
function similarTo(song: SeedSong): SeedSong[] {
  const myThemes = new Set(themesOf(song));
  const myBook = bookOf(song);
  const score = (s: SeedSong) =>
    (song.meter && s.meter === song.meter ? 2 : 0) +
    (myBook && bookOf(s) === myBook ? 2 : 0) +
    themesOf(s).filter(th => myThemes.has(th)).length;
  return songs
    .filter(s => s.id !== song.id && s.language === song.language && score(s) > 0)
    .sort((a, b) => score(b) - score(a) || (a.license === "WC" ? 0 : 1) - (b.license === "WC" ? 0 : 1) || b.downloadCount - a.downloadCount)
    .slice(0, 4);
}

test.beforeAll(async ({ request }) => {
  songs = await (await request.get(`${WC_API}/songs`)).json();
  const withMeter = songs.filter(s => s.meter);
  if (!withMeter.length) throw new Error("Seeded catalog has no song with a meter — re-run reset-commons against a content repo that carries meters");

  // a standalone English song (no family, so "similar" is scoring only) whose top matches include a same-meter song
  const hasFamily = new Set(songs.filter(s => s.parentSongId).flatMap(s => [s.id, s.parentSongId as string]));
  const pick = withMeter.find(s => s.language === "English" && !hasFamily.has(s.id) && similarTo(s).some(o => o.meter === s.meter));
  if (!pick) throw new Error("No English song shares a meter with one of its top matches");
  subject = pick;
  expectedSimilar = similarTo(pick);
});

// the site language pre-filters the library — clear it to assert against the whole catalog
async function openLibrary(page: Page) {
  await page.goto("/songs");
  await page.getByLabel("Language", { exact: true }).selectOption("");
}

test.describe("song meter", () => {
  test("the song page shows the meter as a chip that links to the filtered catalog", async ({ page }) => {
    await page.goto(`/songs/${subject.id}`);
    const chip = page.getByTestId("meter-chip");
    await expect(chip).toContainText(subject.meter as string);

    await chip.click();
    await expect(page).toHaveURL(new RegExp(`/songs\\?meter=${encodeURIComponent(subject.meter as string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    await expect(page.getByTestId("meter-filter")).toHaveValue(subject.meter as string);
  });

  test("similar songs are scored by meter, scripture book and themes", async ({ page }) => {
    await page.goto(`/songs/${subject.id}`);
    const items = page.getByTestId("similar-songs").locator("li");
    await expect(items).toHaveCount(expectedSimilar.length);
    for (let i = 0; i < expectedSimilar.length; i++) await expect(items.nth(i)).toContainText(expectedSimilar[i].title);

    const sameMeter = expectedSimilar.find(s => s.meter === subject.meter) as SeedSong;
    await expect(items.filter({ hasText: sameMeter.title })).toBeVisible();
  });

  test("the catalog filters by meter and the chip clears it", async ({ page }) => {
    const total = songs.length;
    const expected = songs.filter(s => s.meter === subject.meter).length;
    await openLibrary(page);
    await expect(page.locator("#count")).toContainText(`of ${total.toLocaleString()} songs`);

    await page.getByTestId("meter-filter").selectOption(subject.meter as string);
    await expect(page.locator("#count")).toContainText(`of ${expected.toLocaleString()} songs`);
    await expect(page.locator(".t-row", { hasText: subject.title })).toBeVisible();

    await page.locator("#active-chips .active-chip", { hasText: subject.meter as string }).click();
    await expect(page.locator("#count")).toContainText(`of ${total.toLocaleString()} songs`);
  });
});
