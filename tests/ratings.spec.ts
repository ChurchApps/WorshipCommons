import { test, expect } from "@playwright/test";
import { songIdByTitle } from "./helpers/api";

test.describe.serial("ratings", () => {
  test("a signed-in singer rates a song and the average stays hidden below three ratings", async ({ page, request }) => {
    const id = await songIdByTitle(request, "Amazing Grace");
    await page.goto(`/songs/${id}`);

    const stars = page.getByTestId("rating-stars");
    await expect(stars).toBeVisible();
    await expect(page.getByTestId("rating-average")).toHaveCount(0);

    await stars.getByTestId("rating-star-4").click();
    await expect(stars.getByTestId("rating-star-4")).toHaveAttribute("aria-pressed", "true");
    await expect(stars.getByTestId("rating-star-5")).toHaveAttribute("aria-pressed", "false");
    // one rating is not enough to show an average
    await expect(page.getByTestId("rating-average")).toHaveCount(0);

    await page.reload();
    await expect(page.getByTestId("rating-star-4")).toHaveAttribute("aria-pressed", "true");

    // clicking the same star clears it
    await page.getByTestId("rating-star-4").click();
    await expect(page.getByTestId("rating-star-4")).toHaveAttribute("aria-pressed", "false");
  });

  test("signed-out rating asks for a sign-in", async ({ page, request }) => {
    const id = await songIdByTitle(request, "Amazing Grace");
    await page.context().clearCookies();
    await page.goto(`/songs/${id}`);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.getByTestId("rating-star-3").click();
    await expect(page).toHaveURL(/\/login\?next=/);
  });
});
