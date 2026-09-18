import { test, expect } from "@playwright/test";

test("the footer names ChurchApps as who runs the site", async ({ page }) => {
  await page.goto("/");
  const link = page.getByTestId("foot-churchapps");
  await expect(link).toBeVisible();
  await expect(link).toHaveText("A service of ChurchApps");
  await expect(link).toHaveAttribute("href", "https://churchapps.org");
  await expect(page.locator(".foot-legal")).not.toContainText("©");
  await expect(page.locator(".foot-legal")).not.toContainText("WorshipCommons");
});
