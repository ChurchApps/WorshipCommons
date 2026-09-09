import { test, expect } from "@playwright/test";
import { WC_API } from "./helpers/api";

interface Row {
  id: string;
  title: string;
  writer: string;
  license: string;
  confidence?: string;
  firstLine?: string | null;
  videoUrl?: string;
  fileUrls?: Record<string, string>;
}

let rows: Row[] = [];

test.beforeAll(async ({ request }) => {
  rows = await (await request.get(`${WC_API}/songs`)).json();
});

const pdWithFirstLine = () => rows.find(s => s.license === "PD" && s.firstLine && s.fileUrls?.midi) || rows.find(s => s.license === "PD" && s.firstLine);
const byConfidence = (c: string) => rows.filter(s => s.confidence === c);

test.describe("song page: hero, modes, rights", () => {
  test("hero shows the first line and license on a public-domain song", async ({ page }) => {
    const song = pdWithFirstLine();
    test.skip(!song, "no seeded public-domain song carries a first line");
    await page.goto(`/songs/${song!.id}`);

    const hero = page.getByTestId("song-hero");
    await expect(hero).toBeVisible();
    await expect(hero.getByTestId("first-line")).toHaveText(song!.firstLine as string);
    await expect(hero.getByTestId("license-badge")).toHaveAttribute("data-license", "PD");
    await expect(hero.getByTestId("license-badge")).toHaveText("Public domain");
    await expect(page.getByTestId("confidence-badge")).toHaveCount(0);
    await expect(page.getByTestId("ccli-badge")).toHaveCount(0);
    await expect(page.getByTestId("add-to-setlist")).toBeVisible();
  });

  test("copy attribution writes the package attribution (or the license notice) to the clipboard", async ({ page, context, request }) => {
    const song = pdWithFirstLine() || rows.find(s => s.license === "PD");
    test.skip(!song, "no seeded public-domain song");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const detail = await (await request.get(`${WC_API}/songs/${song!.id}`)).json();
    const expected = (detail.attribution || "").trim() || "Public domain. Free for every use, including commercial.";

    await page.goto(`/songs/${song!.id}`);
    const btn = page.getByTestId("rights-copy-attribution");
    await expect(btn).toHaveText("Copy attribution");
    await btn.click();
    await expect(btn).toHaveText("Copied");
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    const normalized = clip.replace(/\r\n?/g, "\n").split("\n").map(x => x.trimEnd()).join("\n").trim(); // Windows clipboard adds CRs
    expect(normalized).toBe(expected);
  });

  test("a song without media gets no preview, tempo, or Lead worship, but still the chart and the Project card", async ({ page, request }) => {
    // summary rows may omit videoUrl, so confirm on the detail that the candidate really has no Listen asset
    let bare: Row | undefined;
    for (const s of rows.filter(r => !r.fileUrls?.midi && !r.fileUrls?.timing && !r.fileUrls?.stemsZip && !r.fileUrls?.sheetPdf && !r.fileUrls?.demoAudio).slice(0, 8)) {
      const detail = await (await request.get(`${WC_API}/songs/${s.id}`)).json();
      if (!detail.videoUrl && !detail.fileUrls?.midi && !detail.fileUrls?.demoAudio) { bare = s; break; }
    }
    test.skip(!bare, "no seeded song without media");
    await page.goto(`/songs/${bare!.id}`);

    // no midi, no stems, no PDF: nothing to preview, no tempo, no Sheet music tab
    await expect(page.getByTestId("tab-sheet")).toHaveCount(0);
    await expect(page.getByTestId("panel-charts")).toBeVisible();
    await expect(page.getByTestId("hero-play")).toHaveCount(0);
    await expect(page.locator("#tempo")).toHaveCount(0);
    await expect(page.getByTestId("sheet-pdf-card")).toHaveCount(0);
    await expect(page.getByTestId("lead-worship")).toHaveCount(0);
    await expect(page.getByTestId("project-panel")).toBeVisible();
  });

  test("a timed hymn previews from the hero, practices from the sidebar, and links Lead worship in the chosen key", async ({ page }) => {
    const timed = rows.find(s => s.fileUrls?.midi && s.fileUrls?.timing);
    test.skip(!timed, "no seeded song with timing and a melody file");
    await page.goto(`/songs/${timed!.id}`);
    await expect(page.getByTestId("hero-play")).toHaveAttribute("aria-label", "Preview (synthesized)");
    await expect(page.locator(".player-meta")).toContainText("Piano preview");
    await expect(page.getByTestId("practice-card").locator("#tempo")).toBeVisible();

    const lead = page.getByTestId("lead-worship");
    await expect(lead).toBeVisible();
    expect(await lead.getAttribute("href")).toContain(`/songs/${timed!.id}/lead?key=`);
  });

  test("Listen offers Watch a performance as a plain external link — no iframe", async ({ page }) => {
    const withVideo = rows.find(s => s.videoUrl && s.fileUrls?.midi) || rows.find(s => s.videoUrl);
    test.skip(!withVideo, "no seeded song with a YouTube link");
    await page.goto(`/songs/${withVideo!.id}`);

    const panel = page.getByTestId("recordings-card");
    await expect(panel).toBeVisible();
    const watch = panel.getByTestId("watch-link");
    await expect(watch).toContainText("Watch a performance");
    await expect(watch).toHaveAttribute("href", withVideo!.videoUrl as string);
    await expect(watch).toHaveAttribute("target", "_blank");
    await expect(panel.locator("iframe")).toHaveCount(0);
    await expect(page.locator(".yt-embed")).toHaveCount(0);
  });

  test("About shows the rights matrix with five uses; project is allowed on a public-domain song", async ({ page }) => {
    const song = rows.find(s => s.license === "PD");
    test.skip(!song, "no seeded public-domain song");
    await page.goto(`/songs/${song!.id}`);
    await page.getByTestId("tab-about").click();

    const matrix = page.getByTestId("rights-matrix");
    await expect(matrix).toBeVisible();
    await expect(matrix.locator("tbody tr")).toHaveCount(5);
    for (const use of ["project", "print", "stream", "arrange", "record"]) {
      await expect(page.getByTestId(`rights-${use}`)).toBeVisible();
    }
    await expect(page.getByTestId("rights-project")).toHaveAttribute("data-allowed", "true");
    await expect(page.getByTestId("rights-project")).toContainText("You may");
    await expect(page.getByTestId("rights-project")).not.toContainText("You may not");
    // the deed lists stay with the matrix, and the pasteable attribution is right there
    await expect(page.getByTestId("you-may")).toContainText("Sell your own arrangement or recording");
    await expect(page.getByTestId("attribution-text")).not.toBeEmpty();
  });

  test("a converted-from-abc score wears the derived banner on the song and sheet pages; chart-only does not", async ({ page }) => {
    const derived = byConfidence("converted-from-abc")[0];
    const chartOnly = byConfidence("chart-only")[0];
    test.skip(!derived || !chartOnly, "seed lacks a converted-from-abc or a chart-only song");

    await page.goto(`/songs/${derived.id}`);
    const banner = page.getByTestId("derived-banner").first();
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("not yet proofread");
    await expect(banner).toHaveAttribute("data-confidence", "converted-from-abc");
    await expect(page.getByTestId("confidence-badge")).toHaveCount(0);

    await page.goto(`/songs/${derived.id}/sheet`);
    await expect(page.getByTestId("derived-banner")).toBeVisible();
    await expect(page.getByTestId("sheet-footer")).toContainText("not yet proofread");
    await expect(page.getByTestId("sheet-footer")).not.toContainText("Free for churches");

    await page.goto(`/songs/${chartOnly.id}`);
    await expect(page.getByTestId("song-hero")).toBeVisible();
    await expect(page.getByTestId("derived-banner")).toHaveCount(0);
  });

  test("the print page adds a large-print size and keeps the attribution in the footer", async ({ page }) => {
    const song = rows.find(s => s.license === "PD");
    test.skip(!song, "no seeded public-domain song");
    await page.goto(`/songs/${song!.id}/print`);
    await expect(page.getByRole("heading", { name: song!.title })).toBeVisible();

    const large = page.getByTestId("print-large");
    await expect(page.getByLabel("Large print")).toBeVisible();
    await large.check();
    await expect(large).toBeChecked();
    const size = await page.locator("main").evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    expect(size).toBeGreaterThanOrEqual(22);
    // section labels stay, and the footer carries the attribution
    await expect(page.locator(".print-stanza p").first()).toBeVisible();
    await expect(page.getByTestId("print-footer")).toContainText("Public domain");
    // the Print button is still the only button called Print
    await expect(page.getByRole("button", { name: "Print" })).toBeVisible();
  });
});
