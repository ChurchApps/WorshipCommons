import { test, expect } from "@playwright/test";

test.describe("home", () => {
  test("hero renders and navigates to the library", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Great music.");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("For every church.");
    await page.getByRole("link", { name: "Find Your Next Song" }).first().click();
    await expect(page).toHaveURL(/\/songs$/);
    await expect(page.getByRole("heading", { name: "Find what your church will sing" })).toBeVisible();
  });

  test("the Sunday set shows four real catalog songs with art", async ({ page }) => {
    await page.goto("/");
    const cards = page.getByTestId("home-top-list").locator("li");
    await expect(cards).toHaveCount(4);
    await expect(cards.first().locator("img, svg").first()).toBeVisible();
    await expect(cards.first().locator(".kind")).toHaveText(/Hymn|Song/);
    await cards.first().locator("h3 a").click();
    await expect(page).toHaveURL(/\/songs\/[^/]+$/);
  });

  test("chips deep-link into a filtered library", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Timeless Hymns", exact: true }).click();
    await expect(page).toHaveURL(/license=PD/);
    await expect(page.locator("#active-chips .active-chip", { hasText: "Public domain" })).toBeVisible();

    await page.goto("/");
    await page.getByRole("link", { name: "New Releases", exact: true }).click();
    await expect(page).toHaveURL(/sort=new/);
    await expect(page.locator("#sort")).toHaveValue("new");
  });

  test("the search bar carries the query into the library", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Search songs").fill("grace");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/\/songs\?q=grace$/);
    await expect(page.locator("#q")).toHaveValue("grace");
  });
});
