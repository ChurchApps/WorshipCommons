import { test, expect } from "@playwright/test";
import { adminJwt, approveSubmission, createPendingSong, pendingSubmissionFor, songIdByTitle } from "./helpers/api";

const WC_TITLE = "License Note Spec Song";

test.describe("license note: you may / you may not", () => {
  test("public-domain hymn spells out that everything is allowed", async ({ page, request }) => {
    await page.goto(`/songs/${await songIdByTitle(request, "Amazing Grace")}`);
    const note = page.locator(".license-note");
    await expect(note).toContainText("Public domain");
    await expect(page.getByTestId("you-may")).toContainText("Sell your own arrangement or recording");
    await expect(page.getByTestId("you-may-not")).toContainText("Claim the original words or tune as your own copyright");
    await expect(page.getByTestId("you-may-not")).not.toContainText("Sell recordings");
  });

  test("writer-licensed song lists worship use and what stays with the writer", async ({ page, request }) => {
    const draft = await createPendingSong(request, await adminJwt(request), WC_TITLE);
    await approveSubmission(request, (await pendingSubmissionFor(request, draft.assetId)).id);
    await page.goto(`/songs/${draft.assetId}`);
    await expect(page.locator(".license-note")).toContainText("WorshipCommons License v1.0");
    await expect(page.getByTestId("you-may")).toContainText("Record or stream your service");
    await expect(page.getByTestId("you-may-not")).toContainText("Sell recordings or sheet music");
    await expect(page.getByTestId("you-may-not")).toContainText("Change what the song means");
  });
});
