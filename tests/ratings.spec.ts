import { test, expect } from "@playwright/test";
import { songIdByTitle } from "./helpers/api";

test.describe("song metrics", () => {
  test("the song page shows downloads and no star rating", async ({ page, request }) => {
    const id = await songIdByTitle(request, "Amazing Grace");
    await page.goto(`/songs/${id}`);

    await expect(page.getByTestId("download-count")).toBeVisible();
    await expect(page.getByTestId("rating-stars")).toHaveCount(0);
    await expect(page.getByTestId("rating-average")).toHaveCount(0);
    await expect(page.getByTestId("propose-edit")).toBeVisible();
  });
});
