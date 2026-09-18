import { test, expect } from "@playwright/test";
import { WC_API } from "./helpers/api";
import { START_HERE } from "../src/catalog";

test.describe("start here", () => {
  test("home shows the curated hymns, not Sunday-ready", async ({ page, request }) => {
    const songs = await (await request.get(`${WC_API}/songs`)).json() as { id: string; title: string; language: string; sundayReady?: boolean }[];
    const english = songs.filter(s => s.language === "English");
    test.skip(english.some(s => s.sundayReady), "listen gate already ran on the demo catalog");
    const pool = english.filter(s => START_HERE.has(s.id));
    expect(pool.length).toBeGreaterThan(0);

    await page.goto("/");
    await expect(page.getByTestId("home-top-heading")).toHaveText("Start here");
    await expect(page.getByTestId("home-top-heading")).not.toContainText("Sunday-ready");
    await expect(page.getByText("Forty hymns with a score and a chart.")).toBeVisible();
    const more = page.getByTestId("home-top-more");
    await expect(more).toHaveAttribute("href", "/songs?start=1");
    await expect(more).toHaveText("See all 40 →");

    const cards = page.getByTestId("home-top-list").locator("li");
    await expect(cards).toHaveCount(4);
    const titles = await cards.locator("h3").allInnerTexts();
    for (const title of titles) expect(pool.some(s => s.title === title), title).toBe(true);
  });

  test("the Start here chip lists only the curated hymns", async ({ page, request }) => {
    const songs = await (await request.get(`${WC_API}/songs`)).json() as { id: string; title: string }[];
    const expected = songs.filter(s => START_HERE.has(s.id));
    test.skip(expected.length === 0, "seed missing start-here ids");

    await page.goto("/");
    await page.getByTestId("start-here-chip").click();
    await expect(page).toHaveURL(/start=1/);
    await expect(page.locator("#active-chips .active-chip", { hasText: "Start here" })).toBeVisible();
    await expect(page.locator("#count")).toContainText(`of ${expected.length.toLocaleString()} songs`);
    const titles = await page.locator(".t-row .t-main a").allInnerTexts();
    expect(titles.length).toBe(Math.min(50, expected.length));
    for (const title of titles) expect(expected.some(s => s.title === title), title).toBe(true);
  });
});
