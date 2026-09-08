import { test, expect, Page } from "@playwright/test";
import { WC_API } from "./helpers/api";

interface SeedSong {
  id: string; title: string; language: string; license: string; rank?: number;
  confidence?: string; sundayReady?: boolean; featured?: boolean; firstLine?: string | null; tune?: string | null;
  hasChords?: boolean; hasScore?: boolean; hasAccompaniment?: boolean; fileUrls?: Record<string, string>;
}

// the same six labels the badge wears (src/components/ConfidenceBadge.tsx)
const LABEL: Record<string, string> = {
  "sunday-ready": "Sunday-ready",
  "proofread-score": "Proofread score",
  "converted-from-abc": "Converted from ABC",
  "generated-from-midi": "Generated from MIDI",
  "chart-only": "Chart only",
  "lyrics-only": "Lyrics only"
};
const CATALOG_THRESHOLD = 25;

// expectations are computed from the live seed so the catalog can grow without breaking specs
let songs: SeedSong[] = [];
const countText = (n: number) => (n ? `of ${n.toLocaleString()} songs` : "No songs found");
const guitarReady = (s: SeedSong) => !!s.hasChords && !!(s.hasAccompaniment || s.hasScore);
// mirrors src/catalog.ts: Sunday-ready set, with the transitional scored-package fallback
const isCatalog = (language: string) => {
  const rows = songs.filter(s => s.language === language);
  return rows.filter(s => s.sundayReady).length >= CATALOG_THRESHOLD || rows.filter(s => s.hasScore).length >= CATALOG_THRESHOLD;
};

test.beforeAll(async ({ request }) => {
  songs = await (await request.get(`${WC_API}/songs`)).json();
});

// the site language pre-filters the library — clear it to face the whole catalog
async function openLibrary(page: Page) {
  await page.goto("/songs");
  await page.getByLabel("Language", { exact: true }).selectOption("");
  await expect(page.locator("#count")).toContainText(countText(songs.length));
}

test.describe("search, filters and ranking", () => {
  test("the confidence facet lists the values in the seed and filters to one badge", async ({ page }) => {
    await openLibrary(page);
    const present = [...new Set(songs.map(s => s.confidence).filter(Boolean))] as string[];
    expect(present.length).toBeGreaterThan(0);
    const facet = page.getByTestId("confidence-facet");
    await expect(facet.locator("input[type=checkbox]")).toHaveCount(present.length);
    for (const c of present) await expect(facet.locator(`input[value="${c}"]`)).toHaveCount(1);
    // a value the seed does not carry is never offered
    for (const c of Object.keys(LABEL).filter(c => !present.includes(c))) await expect(facet.locator(`input[value="${c}"]`)).toHaveCount(0);

    test.skip(!present.includes("converted-from-abc"), "seed has no converted-from-abc package");
    const abc = songs.filter(s => s.confidence === "converted-from-abc").length;
    await facet.locator('input[value="converted-from-abc"]').check();
    await expect(page.locator("#count")).toContainText(countText(abc));
    await expect(page.locator("#active-chips")).toContainText("Converted from ABC");
    await expect(page.locator(".t-row")).toHaveCount(Math.min(50, abc));
  });

  test("rows carry no badges; the reason line names a signal where one exists", async ({ page }) => {
    await openLibrary(page);
    const rows = page.locator(".t-row");
    await expect(rows).toHaveCount(Math.min(50, songs.length));
    await expect(rows.locator("[data-testid='confidence-badge'], [data-testid='license-badge']")).toHaveCount(0);

    // a reason shows only where a completeness or provenance signal adds to the badges
    const reasons = page.getByTestId("rank-reason");
    if (songs.some(s => s.hasScore || s.hasChords)) {
      await expect(reasons.first()).toBeVisible();
      for (const text of await reasons.allInnerTexts()) expect(text).toMatch(/in 200\+ hymnals|has score|chart with chords/);
    }
  });

  test("Works with just a guitar and Has chart narrow to rows with chords", async ({ page }) => {
    await openLibrary(page);
    const ready = page.getByTestId("ready-facet");
    // vocal range is not offered: no package carries range data yet
    await expect(ready).not.toContainText("Vocal range");

    const guitar = songs.filter(guitarReady).length;
    await ready.getByLabel(/Works with just a guitar/).check();
    await expect(page.locator("#count")).toContainText(countText(guitar));
    await expect(page.locator("#active-chips")).toContainText("Works with just a guitar");
    await ready.getByLabel(/Works with just a guitar/).uncheck();

    const chart = songs.filter(s => s.hasChords).length;
    await ready.getByLabel(/Has chart/).check();
    await expect(page.locator("#count")).toContainText(countText(chart));
    if (chart > 0) {
      // every row on the first page is one the seed says has chords
      const titles = await page.locator(".t-row .t-main a").allInnerTexts();
      for (const title of titles) expect(songs.some(s => s.title === title && s.hasChords), title).toBe(true);
    }

    const score = songs.filter(s => s.hasScore).length;
    await ready.getByLabel(/Has score/).check();
    await expect(page.locator("#count")).toContainText(countText(songs.filter(s => s.hasChords && s.hasScore).length));
    await ready.getByLabel(/Has chart/).uncheck();
    await expect(page.locator("#count")).toContainText(countText(score));
  });

  test("free text finds a song by its first line", async ({ page }) => {
    const song = songs.find(s => s.firstLine && s.firstLine.trim().length >= 12 && !s.title.toLowerCase().includes(s.firstLine.trim().slice(0, 12).toLowerCase()));
    test.skip(!song, "seed has no first lines");
    const needle = song!.firstLine!.trim().slice(0, 12);
    await openLibrary(page);
    await expect(page.locator("#q")).toHaveAttribute("placeholder", /first line, tune/);
    await page.fill("#q", needle);
    const expected = songs.filter(s => [s.title, s.firstLine || "", s.tune || ""].join(" ").toLowerCase().includes(needle.toLowerCase())).length;
    expect(expected).toBeGreaterThan(0);
    await expect(page.locator(".t-row", { hasText: song!.title }).first()).toBeVisible();
  });

  test("the empty state points to SongSelect with the query encoded", async ({ page }) => {
    await openLibrary(page);
    const q = "zzzz no such song";
    await page.fill("#q", q);
    await expect(page.getByText("Nothing matches yet")).toBeVisible();
    await expect(page.getByRole("link", { name: "share the song the commons is missing" })).toHaveAttribute("href", "/upload");
    const link = page.getByTestId("songselect-link");
    await expect(link).toHaveAttribute("href", `https://songselect.ccli.com/search/results?SearchText=${encodeURIComponent(q)}`);
    await expect(link).toHaveAttribute("target", "_blank");
  });

  test("browse languages are tagged in the facet and still searchable", async ({ page }) => {
    const browse = [...new Set(songs.map(s => s.language))].filter(l => !isCatalog(l));
    test.skip(browse.length === 0, "every seed language is a catalog");
    await openLibrary(page);
    const facet = page.getByTestId("language-facet");
    await expect(facet.locator(`option[value="${browse[0]}"]`)).toContainText("browse");
    for (const l of [...new Set(songs.map(s => s.language))].filter(isCatalog)) await expect(facet.locator(`option[value="${l}"]`)).not.toContainText("browse");
    await facet.selectOption(browse[0]);
    await expect(page.locator("#count")).toContainText(countText(songs.filter(s => s.language === browse[0]).length));
  });
});

test.describe("home", () => {
  test("the first block is Sunday-ready, or says honestly what it shows instead", async ({ page }) => {
    const english = songs.filter(s => s.language === "English");
    const heading = english.some(s => s.sundayReady || s.featured) ? "Sunday-ready"
      : english.some(s => s.hasScore) ? "Scored hymns, ready to sing" : "Most downloaded in the commons";
    await page.goto("/");
    await expect(page.getByTestId("home-top-heading")).toHaveText(heading);
    await expect(page.getByTestId("hp-top-heading")).toHaveText(heading);
    if (heading !== "Sunday-ready") await expect(page.getByTestId("home-top-heading")).not.toContainText("Sunday-ready");

    // the block is ranked within the UI language; the first card is the top-ranked eligible English title
    const pool = heading === "Sunday-ready" ? english.filter(s => s.sundayReady || s.featured) : heading.startsWith("Scored") ? english.filter(s => s.hasScore) : english;
    const first = [...pool].sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0))[0];
    await expect(page.getByTestId("home-top-list").locator("li").first()).toContainText(first.title);
    await expect(page.locator(".row-list [data-testid='confidence-badge'], .row-list .free-badge")).toHaveCount(0);
  });

  test("headline totals count catalog languages and note the browse languages", async ({ page }) => {
    const langs = [...new Set(songs.map(s => s.language))];
    const catalog = langs.filter(isCatalog);
    const browse = langs.filter(l => !isCatalog(l));
    await page.goto("/");
    if (catalog.length && browse.length) {
      await expect(page.getByTestId("browse-langs").first()).toHaveText(`+ ${browse.length} browse languages`);
      await expect(page.locator(".hero-proof")).toContainText(`${catalog.length} languages`);
      await expect(page.locator(".hero-proof")).toContainText(`${songs.filter(s => catalog.includes(s.language)).length.toLocaleString()} songs`);
    } else {
      await expect(page.getByTestId("browse-langs")).toHaveCount(0);
    }
  });
});
