import { test, expect } from "@playwright/test";

test("the footer copyright link opens the DMCA section on the terms page", async ({ page }) => {
  await page.goto("/");
  const link = page.getByTestId("foot-dmca");
  await expect(link).toBeVisible();
  await link.click();

  await expect(page).toHaveURL(/\/terms#copyright$/);
  const section = page.getByTestId("dmca-section");
  await expect(section).toBeVisible();
  await expect(section.getByRole("heading", { name: "Copyright / DMCA" })).toBeVisible();
  await expect(section).toContainText("WorshipCommons copyright agent");
  await expect(section.getByTestId("dmca-agent-email")).toHaveAttribute("href", "mailto:support@worshipcommons.org");
});

test("the DMCA section points at the report form and covers counter-notices", async ({ page }) => {
  await page.goto("/terms#copyright");
  const section = page.getByTestId("dmca-section");
  await expect(section).toBeVisible();
  await expect(section).toContainText("counter-notice");

  await section.getByRole("link", { name: "report form" }).click();
  await expect(page).toHaveURL(/\/report$/);
  await expect(page.getByRole("heading", { name: "Report a song" })).toBeVisible();
});
