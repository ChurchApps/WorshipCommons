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
  await expect(section).toContainText("Micheal Byrd");
  await expect(section).toContainText("LIVE CHURCH SOLUTIONS INC");
  await expect(section).toContainText("PO Box 1553");
  await expect(section).toContainText("Broken Arrow, OK 74013");
  await expect(section).toContainText("918-994-2638");
  await expect(section.getByTestId("dmca-agent-email")).toHaveAttribute("href", "mailto:micheal@livechurchsolutions.org");
  await expect(section.getByTestId("dmca-agent-email")).toHaveText("micheal@livechurchsolutions.org");
  await expect(section.getByTestId("dmca-registration")).toContainText("DMCA-1080721");
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
