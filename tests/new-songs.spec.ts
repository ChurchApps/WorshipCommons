import { test, expect } from "@playwright/test";
import { WC_API } from "./helpers/api";

const recency = (s: { publishedAt?: string; createdAt?: string }) => Date.parse(s.publishedAt || s.createdAt || "");

test.describe("new songs", () => {
  test("lists the newest published song first, grouped by descending month", async ({ page, request }) => {
    const all = await (await request.get(`${WC_API}/songs`)).json();
    const dated = all.filter((s: any) => !Number.isNaN(recency(s))).sort((a: any, b: any) => recency(b) - recency(a));
    expect(dated.length, "seed catalog has no published dates to changelog").toBeGreaterThan(0);

    await page.goto("/new");
    await expect(page.getByRole("heading", { level: 1, name: "New songs" })).toBeVisible();

    const rows = page.getByTestId("new-song");
    await expect(rows.first()).toBeVisible();
    await expect(rows.first().getByRole("link").first()).toHaveText(dated[0].title);
    // the page is a changelog window, not the whole library (LIMIT in src/pages/New.tsx)
    await expect(rows).toHaveCount(Math.min(dated.length, 100));

    // month headings run newest → oldest
    const labels = await page.getByTestId("new-month").allInnerTexts();
    expect(labels.length).toBeGreaterThan(0);
    const stamps = labels.map(l => Date.parse(l));
    expect(stamps.some(Number.isNaN), `unparseable month heading in ${labels.join(", ")}`).toBe(false);
    expect(stamps).toEqual([...stamps].sort((a, b) => b - a));
    expect(new Set(labels).size).toBe(labels.length);
  });

  test("the footer links to the changelog and rows link back to the song", async ({ page }) => {
    await page.goto("/");
    await page.locator(".site-footer").getByRole("link", { name: "New songs" }).click();
    await expect(page).toHaveURL(/\/new$/);

    const first = page.getByTestId("new-song").first().getByRole("link").first();
    const title = await first.innerText();
    await first.click();
    await expect(page).toHaveURL(/\/songs\/[^/]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(title);
  });
});
