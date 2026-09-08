import { test, expect } from "@playwright/test";
import { songIdByTitle, WC_API } from "./helpers/api";

test.describe("inline melody", () => {
  test("song page engraves the melody and follows the selected key", async ({ page, request }) => {
    await page.goto(`/songs/${await songIdByTitle(request, "Amazing Grace")}`);
    const card = page.getByTestId("melody-card");
    await expect(card).toBeVisible();
    await expect(card.locator("svg").first()).toBeVisible();
    // lyrics ride along when the score is this hymn's own tune
    await expect(card).toContainText("wretch");
    // first verse only — the score's later verses and credits stay on the sheet page
    await expect(card).not.toContainText("ten thousand years");
    await expect(card).not.toContainText("Open Hymnal");
    // only the top voice — one staff's worth of ink, far less than the four-part sheet page
    const inlinePaths = await card.locator("svg path").count();

    await page.selectOption("#transpose", "A");
    await expect(card).toContainText("Engraved in A");
    await expect(card.locator("svg").first()).toBeVisible();

    await page.goto(`/songs/${await songIdByTitle(request, "Amazing Grace")}/sheet`);
    await expect(page.getByTestId("sheet-paper").locator("svg")).toBeVisible();
    expect(await page.getByTestId("sheet-paper").locator("svg path").count()).toBeGreaterThan(inlinePaths);
  });

  test("borrowed tune shows the melody without another hymn's words", async ({ page, request }) => {
    await page.goto(`/songs/${await songIdByTitle(request, "Adeste Fideles")}`);
    const card = page.getByTestId("melody-card");
    await expect(card.locator("svg").first()).toBeVisible();
    await expect(card).not.toContainText("choirs");
  });

  test("no score, no melody card", async ({ page, request }) => {
    const list = await (await request.get(`${WC_API}/songs`)).json();
    const bare = list.find((s: { fileUrls?: Record<string, string> }) => !s.fileUrls?.abc);
    await page.goto(`/songs/${bare.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByTestId("melody-card")).toHaveCount(0);
  });
});
