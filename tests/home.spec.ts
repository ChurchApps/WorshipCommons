import { test, expect } from "@playwright/test";

test.describe("home", () => {
  test("hero renders and navigates to the library", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Worship music");
    await page.getByRole("link", { name: "Explore the songs" }).first().click();
    await expect(page).toHaveURL(/\/songs$/);
    await expect(page.getByRole("heading", { name: "Find what your church will sing" })).toBeVisible();
  });

  test("theme chip deep-links into a filtered library", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Advent", exact: true }).click();
    await expect(page).toHaveURL(/theme=Advent/);
    await expect(page.locator("#active-chips .active-chip", { hasText: "Advent" })).toBeVisible();
  });
});
