import { test, expect } from "@playwright/test";
import { adminJwt, approveSubmission, createPendingSong, pendingSubmissionFor, songIdByTitle } from "./helpers/api";

const TITLE = "No Chords Controls Spec Song";
const LYRICS_ONLY = "Verse 1\nA line of lyrics with no chords\nAnd a second line of the same\n\nChorus\nStill nothing to transpose here";

test.describe("chord controls follow the chart", () => {
  test("a lyrics-only song hides key, capo, transpose, and the chord switches", async ({ page, request }) => {
    const jwt = await adminJwt(request);
    const draft = await createPendingSong(request, jwt, TITLE, { chordPro: LYRICS_ONLY });
    await approveSubmission(request, (await pendingSubmissionFor(request, draft.assetId)).id);

    await page.goto(`/songs/${draft.assetId}`);
    await expect(page.locator(".sheet-body")).toContainText("A line of lyrics with no chords");
    await expect(page.locator("#transpose")).toHaveCount(0);
    await expect(page.locator("#capo")).toHaveCount(0);
    await expect(page.locator("#chords-toggle")).toHaveCount(0);
    await expect(page.locator("#nashville-toggle")).toHaveCount(0);

    // the controls that have nothing to do with chords stay
    await expect(page.getByTestId("copy-lyrics")).toBeVisible();
    await expect(page.locator(".text-size")).toBeVisible();
  });

  test("a chorded song still gets the full set of controls", async ({ page, request }) => {
    await page.goto(`/songs/${await songIdByTitle(request, "Amazing Grace")}`);
    await expect(page.locator("#transpose")).toBeVisible();
    await expect(page.locator("#capo")).toBeVisible();
    await expect(page.locator("#chords-toggle")).toBeVisible();
    await expect(page.locator("#nashville-toggle")).toBeVisible();
    await expect(page.getByTestId("copy-lyrics")).toBeVisible();
  });
});
