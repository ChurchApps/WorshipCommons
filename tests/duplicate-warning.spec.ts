import { test, expect } from "@playwright/test";
import { songIdByTitle } from "./helpers/api";

const SEEDED = "Amazing Grace";

test.describe("duplicate warning on upload", () => {
  test("warns about a song already in the library, and clears once it is a different song", async ({ page, request }) => {
    const seededId = await songIdByTitle(request, SEEDED);

    await page.goto("/upload");
    await expect(page.getByRole("heading", { name: "Give the church something to sing" })).toBeVisible();
    await expect(page.getByTestId("duplicate-warning")).toBeHidden();

    await page.fill("#title", SEEDED);
    await page.fill("#writers", "John Newton");

    const warning = page.getByTestId("duplicate-warning");
    await expect(warning).toBeVisible();
    await expect(warning).toContainText(SEEDED);
    await expect(warning.getByRole("link", { name: new RegExp(SEEDED) })).toHaveAttribute("href", `/songs/${seededId}`);
    await expect(warning).toContainText("propose an edit there instead");

    // a genuinely new song is not accused of anything
    await page.fill("#title", "A Song Playwright Just Wrote");
    await page.fill("#writers", "Playwright Composer");
    await expect(warning).toBeHidden();

    // the same first sung line still gives it away, even retitled
    await page.fill("#lyrics", "Verse 1\n[G]Amazing grace! how [C]sweet the [G]sound,\nthat saved a wretch like [D]me!");
    await expect(warning).toBeVisible();
    await expect(warning.getByRole("link", { name: new RegExp(SEEDED) })).toHaveAttribute("href", `/songs/${seededId}`);
  });
});
