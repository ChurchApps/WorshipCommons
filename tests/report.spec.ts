import { test, expect } from "@playwright/test";
import { songIdByTitle } from "./helpers/api";

test("copyright report needs the signed ownership claim", async ({ page }) => {
  await page.goto("/report");
  await expect(page.getByRole("heading", { name: "Report a song" })).toBeVisible();

  await page.fill("#song", "Abide, O Dearest Jesus — I never agreed to this");
  await page.selectOption("#relation", { index: 3 });
  await page.fill("#details", "I co-wrote this song in 2023 and was never asked before it was shared here.");
  await page.fill("#name", "Casey Co-writer");
  await page.fill("#email", "casey@example.com");
  await page.check("#goodfaith");
  await page.fill("#signature", "Casey Co-writer");
  await page.getByRole("button", { name: "Send the report" }).click();

  await expect(page.getByTestId("report-thanks")).toBeVisible();
  await expect(page.getByTestId("report-thanks")).toContainText("Thanks for guarding the commons");
});

test("a policy report needs no signature", async ({ page, request }) => {
  const id = await songIdByTitle(request, "Amazing Grace");
  await page.goto(`/report?song=${encodeURIComponent(`Amazing Grace — /songs/${id}`)}`);

  await expect(page.locator("#song")).toHaveValue(new RegExp(id));
  await page.selectOption("#reason", "policy");
  await expect(page.locator("#signature")).toHaveCount(0);
  await expect(page.locator("#relation")).toHaveCount(0);

  await page.fill("#details", "This one doesn't belong in a worship library.");
  await page.getByRole("button", { name: "Send the report" }).click();
  await expect(page.getByTestId("report-thanks")).toBeVisible();
});
