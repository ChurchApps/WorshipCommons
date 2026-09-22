import { test, expect } from "@playwright/test";

const SONG = {
  id: "YxPfAFYWOaG",
  title: "Amazing Grace",
  writer: "John Newton",
  year: 1779,
  language: "English",
  license: "PD",
  themes: "Grace",
  songKey: "G",
  bpm: 90,
  timeSignature: "3/4",
  confidence: "score",
  hasChords: true,
  hasScore: true,
  sundayReady: false,
  fileUrls: {},
  downloadCount: 3,
  saveCount: 1,
  rank: 10
};

const isList = (url: string) => new URL(url).pathname.endsWith("/commons/songs");
const isPage = (url: string) => /\/commons\/songs\/[^/]+\/page$/.test(new URL(url).pathname);

test("home offers a retry when the catalog fails, and does not claim zero songs", async ({ page }) => {
  let fail = true;
  await page.route(isList, route => fail ? route.abort() : route.fulfill({ json: [SONG] }));
  await page.goto("/");
  await expect(page.getByTestId("catalog-error")).toBeVisible();
  await expect(page.getByTestId("home-langs")).toHaveCount(0);
  await expect(page.getByText("0 songs")).toHaveCount(0);
  await page.addStyleTag({ content: ".rise{animation:none!important;opacity:1!important}" });
  await page.getByTestId("catalog-error").scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".pr-screenshots/after.png" });
  fail = false;
  await page.getByTestId("catalog-retry").click();
  await expect(page.getByTestId("home-langs")).toHaveText("1 languages");
});

test("library offers a retry instead of an empty catalog", async ({ page }) => {
  await page.route(isList, route => route.abort());
  await page.goto("/songs");
  await expect(page.getByTestId("catalog-error")).toBeVisible();
  await expect(page.getByText("No songs found")).toHaveCount(0);
});

test("a fresh catalog survives tab focus", async ({ page }) => {
  let hits = 0;
  await page.route(isList, route => { hits += 1; return route.fulfill({ json: [SONG] }); });
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Amazing Grace" }).first()).toBeVisible();
  await page.addStyleTag({ content: ".rise{animation:none!important;opacity:1!important}" });
  await page.getByTestId("home-langs").scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".pr-screenshots/before.png" });
  const afterLoad = hits;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.getByRole("link", { name: "Find your next song" }).first().click();
  await expect(page.getByRole("link", { name: "Amazing Grace" }).first()).toBeVisible();
  expect(hits).toBe(afterLoad);
});

test("a song request that fails is not shown as a missing song", async ({ page }) => {
  let fail = true;
  await page.route(isPage, route => fail
    ? route.fulfill({ status: 500, contentType: "application/json", body: "{}" })
    : route.fulfill({ json: { song: SONG, history: [], family: [], similar: [] } }));
  await page.goto("/songs/amazing-grace-YxPfAFYWOaG");
  await expect(page.getByTestId("song-load-error")).toBeVisible();
  await expect(page.getByText("Song not found.")).toHaveCount(0);
  fail = false;
  await page.getByTestId("song-retry").click();
  await expect(page.getByRole("heading", { name: "Amazing Grace" })).toBeVisible();
});

test("a missing song is still not found", async ({ page }) => {
  await page.route(isPage, route => route.fulfill({ status: 404, contentType: "application/json", body: "{}" }));
  await page.goto("/songs/amazing-grace-YxPfAFYWOaG");
  await expect(page.getByText("Song not found.")).toBeVisible();
  await expect(page.getByTestId("song-load-error")).toHaveCount(0);
});
