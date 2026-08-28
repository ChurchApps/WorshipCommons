import { test, expect, Page } from "@playwright/test";
import { WC_API } from "./helpers/api";

interface SeedSong { title: string; writer: string; scripture: string; themes: string; bpm: number; year: number; language: string; license: string; downloadCount: number; publishedAt?: string; createdAt?: string; fileUrls?: Record<string, string>; }

// expectations are computed from the live seed so the catalog can grow without breaking specs
let songs: SeedSong[] = [];
const themeOf = (s: SeedSong) => (s.themes || "").split(",").map(t => t.trim());
const countText = (n: number) => (n ? `of ${n.toLocaleString()} songs` : "No songs found");
const firstPage = (n: number) => Math.min(50, n);

test.beforeAll(async ({ request }) => {
  songs = await (await request.get(`${WC_API}/songs`)).json();
});

// the site language pre-filters the library — clear it to assert against the whole catalog
async function openLibrary(page: Page) {
  await page.goto("/songs");
  await page.getByLabel("Language", { exact: true }).selectOption("");
  await expect(page.locator("#count")).toContainText(countText(songs.length));
}

test.describe("library", () => {
  test("shows the full catalog with badges, most-downloaded first", async ({ page }) => {
    await openLibrary(page);
    await expect(page.locator(".t-row")).toHaveCount(firstPage(songs.length));

    const mostDownloaded = [...songs].sort((a, b) => b.downloadCount - a.downloadCount)[0];
    await expect(page.locator(".t-row").first()).toContainText(mostDownloaded.title);

    const topPd = [...songs].sort((a, b) => b.downloadCount - a.downloadCount).find(s => s.license === "PD");
    await expect(page.locator(".t-row", { hasText: topPd.title }).locator(".pd-badge")).toHaveText("Public domain");

    await page.fill("#q", "amazing grace");
    await expect(page.locator(".t-row", { hasText: "Amazing Grace" }).first().locator(".pd-badge")).toHaveText("Public domain");
  });

  test("search narrows results and empty state appears for no matches", async ({ page }) => {
    await openLibrary(page);
    const expected = songs.filter(s => `${s.title} ${s.writer} ${s.scripture} ${s.themes}`.toLowerCase().includes("amazing")).length;
    await page.fill("#q", "amazing");
    await expect(page.locator(".t-row")).toHaveCount(expected);
    await expect(page.locator(".t-row", { hasText: "Amazing Grace" })).toBeVisible();

    await page.fill("#q", "zzzz-no-song");
    await expect(page.getByText("Nothing matches yet")).toBeVisible();
  });

  test("theme facet filters and its chip removes the filter", async ({ page }) => {
    await openLibrary(page);
    const advent = songs.filter(s => themeOf(s).includes("Advent")).length;
    await page.getByRole("button", { name: "Show more" }).click();  // the theme facet lists the top 5 until expanded
    await page.getByLabel(/^ Advent/).check();
    await expect(page.locator("#count")).toContainText(countText(advent));
    await expect(page.locator(".t-row", { hasText: "O Come, O Come, Emmanuel" })).toBeVisible();

    await page.locator("#active-chips .active-chip", { hasText: "Advent" }).click();
    await expect(page.locator("#count")).toContainText(countText(songs.length));
  });

  test("tempo, language, source and extras facets filter", async ({ page }) => {
    await openLibrary(page);
    const slow = songs.filter(s => s.bpm <= 72).length;
    await page.getByLabel(/Slow · under 73/).check();
    await expect(page.locator("#count")).toContainText(countText(slow));
    await page.getByLabel(/Any tempo/).check();

    const spanish = songs.filter(s => s.language === "Spanish");
    await page.getByLabel("Language", { exact: true }).selectOption("Spanish");
    await expect(page.locator(".t-row")).toHaveCount(firstPage(spanish.length));
    await expect(page.locator(".t-row", { hasText: "Santo, Santo, Santo" })).toBeVisible();
    await page.getByLabel("Language", { exact: true }).selectOption("");

    const pd = songs.filter(s => s.license === "PD").length;
    await page.getByLabel(/Public domain/).check();
    await expect(page.locator("#count")).toContainText(countText(pd));
    await page.getByLabel(/All songs/).check();

    const audio = songs.filter(s => s.fileUrls?.demoAudio).length;
    await page.getByLabel(/Has demo recording/).check();
    await expect(page.locator("#count")).toContainText(countText(audio));

    const audioAndStems = songs.filter(s => s.fileUrls?.demoAudio && s.fileUrls?.stemsZip).length;
    await page.getByLabel(/Has multitracks/).check();
    await expect(page.locator("#count")).toContainText(countText(audioAndStems));
  });

  test("clear all restores the full list", async ({ page }) => {
    await openLibrary(page);
    await page.getByLabel(/^ Grace/).check();
    await page.getByLabel(/Has demo recording/).check();
    await expect(page.locator("#active-chips .active-chip")).toHaveCount(2);
    await page.getByRole("button", { name: "Clear all filters" }).click();
    await expect(page.locator("#count")).toContainText(countText(songs.length));
    await expect(page.locator("#active-chips .active-chip")).toHaveCount(0);
  });

  test("sorting reorders the list", async ({ page }) => {
    await openLibrary(page);
    const azFirst = [...songs].sort((a, b) => a.title.localeCompare(b.title))[0];
    await page.selectOption("#sort", "az");
    await expect(page.locator(".t-row").first()).toContainText(azFirst.title);

    const recency = (s: SeedSong) => {
      const t = Date.parse(s.publishedAt || s.createdAt || "");
      return Number.isNaN(t) ? s.year || 0 : t;
    };
    const newFirst = [...songs].sort((a, b) => recency(b) - recency(a))[0];
    await page.selectOption("#sort", "new");
    await expect(page.locator(".t-row").first()).toContainText(newFirst.title);
  });

  test("the language toggle translates the page and filters the list", async ({ page }) => {
    await page.goto("/songs");
    const english = songs.filter(s => s.language === "English").length;
    await expect(page.locator("#count")).toContainText(countText(english));

    await page.getByTestId("lang-select").selectOption("es");
    const spanish = songs.filter(s => s.language === "Spanish");
    await expect(page.locator(".t-row")).toHaveCount(firstPage(spanish.length));
    await expect(page.locator(".t-row", { hasText: "Santo, Santo, Santo" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Borrar todos los filtros" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "Encuentra lo que tu iglesia va a cantar" })).toBeVisible();
    await page.getByTestId("lang-select").selectOption("en");
    await expect(page.locator("#count")).toContainText(countText(english));
  });

  test("pagination walks the catalog", async ({ page }) => {
    test.skip(songs.length <= 50, "catalog fits on one page");
    await openLibrary(page);
    await page.locator(".pager").getByRole("button", { name: "2", exact: true }).click();
    await expect(page.locator("#count")).toContainText("Showing 51–");
    await expect(page.locator(".t-row")).toHaveCount(Math.min(50, songs.length - 50));
    await page.locator(".pager button", { hasText: "‹" }).click();
    await expect(page.locator("#count")).toContainText("Showing 1–");
  });
});
