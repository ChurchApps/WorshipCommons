import type { Page } from "@playwright/test";
import { test, expect, openAndLoad } from "./fixtures";

// The catalog list every listing page loads, and the per-song endpoints.
const CATALOG = /\/commons\/songs$/;
const SONG_PAGE = /\/commons\/songs\/[^/]+\/page$/;
const SONG = /\/commons\/songs\/[^/]+$/;

/** The first song in the library listing, so no slug is hard-coded. */
async function firstSongPath(page: Page) {
  await openAndLoad(page, "/songs", CATALOG);
  const link = page.locator(".t-row .t-main a").first();
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");
  expect(href, "first song link").toMatch(/^\/songs\/[^/]+$/);
  return href!;
}

test("home loads the catalog", async ({ page }) => {
  await openAndLoad(page, "/", CATALOG);
  await expect(page.getByTestId("catalog-error")).toHaveCount(0);
  await expect(page.getByTestId("home-top-list").locator("a").first()).toBeVisible();
});

test("library lists songs and filters by search", async ({ page }) => {
  await openAndLoad(page, "/songs", CATALOG);
  await expect(page.locator("#count")).toContainText(/of [\d,]+ songs/);
  const first = page.locator(".t-row .t-main a").first();
  const title = (await first.innerText()).trim();
  await page.fill("#q", title);
  await expect(page.locator(".t-row", { hasText: title }).first()).toBeVisible();
});

test("a collection page lists hymns", async ({ page }) => {
  await openAndLoad(page, "/hymns", CATALOG);
  await expect(page.locator('main a[href^="/songs/"]').first()).toBeVisible();
});

test("a song page renders its chart", async ({ page }) => {
  const path = await firstSongPath(page);
  await openAndLoad(page, path, SONG_PAGE);
  await expect(page.getByTestId("song-load-error")).toHaveCount(0);
  await expect(page.getByTestId("song-hero")).toBeVisible();
  await expect(page.getByTestId("panel-charts")).toBeVisible();
});

test("a writer page lists the writer's songs", async ({ page }) => {
  const path = await firstSongPath(page);
  await openAndLoad(page, path, SONG_PAGE);
  const writer = page.locator('a[href^="/writers/"]').first();
  await expect(writer).toBeVisible();
  await openAndLoad(page, (await writer.getAttribute("href"))!, CATALOG);
  await expect(page.getByTestId("writer-song").first()).toBeVisible();
});

test("the print chart loads its song", async ({ page }) => {
  const path = await firstSongPath(page);
  await openAndLoad(page, `${path}/print`, SONG);
  await expect(page.getByTestId("song-load-error")).toHaveCount(0);
  await expect(page.locator("h1")).not.toBeEmpty();
  await expect(page.locator(".print-stanza").first()).toBeVisible();
});
