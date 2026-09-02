import { test, expect } from "@playwright/test";

test.describe("call for songs", () => {
  test("landing page renders for student and seminary writers", async ({ page }) => {
    await page.goto("/call-for-songs");
    await expect(page.getByTestId("call-for-songs")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Write a song the church can actually sing");
    await expect(page.getByRole("heading", { name: "What WorshipCommons is" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Bring it to your department" })).toBeVisible();
    await expect(page.getByTestId("call-for-songs")).toContainText("Full ownership of your song");
  });

  test("both CTAs navigate", async ({ page }) => {
    await page.goto("/call-for-songs");
    await page.getByTestId("cfs-upload").click();
    await expect(page).toHaveURL(/\/upload$/);

    await page.goto("/call-for-songs");
    await page.getByTestId("cfs-license").click();
    await expect(page).toHaveURL(/\/license#release$/);
    await expect(page.getByRole("heading", { name: "Releasing a song without uploading it" })).toBeVisible();
  });

  test("linked from the home writers block and the footer", async ({ page }) => {
    await page.goto("/");
    await page.locator("#writers").getByRole("link", { name: /For students and seminaries/ }).click();
    await expect(page).toHaveURL(/\/call-for-songs$/);

    await page.goto("/");
    await page.locator(".site-footer").getByRole("link", { name: "Call for songs" }).click();
    await expect(page).toHaveURL(/\/call-for-songs$/);
    await expect(page.getByTestId("call-for-songs")).toBeVisible();
  });
});
