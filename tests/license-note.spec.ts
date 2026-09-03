import { test, expect } from "@playwright/test";
import { adminJwt, approveSubmission, createPendingSong, pendingSubmissionFor, songIdByTitle } from "./helpers/api";

const WC_TITLE = "License Note Spec Song";
// harvested CC BY 3.0 song (C. Michael Pilato) seeded from songs/en/cc-by/home
const CC_BY_TITLE = "Home";

test.describe("license note: you may / you may not", () => {
  test("public-domain hymn spells out that everything is allowed", async ({ page, request }) => {
    await page.goto(`/songs/${await songIdByTitle(request, "Amazing Grace")}`);
    const note = page.locator(".license-note");
    await expect(note).toContainText("Public domain");
    await expect(note).toContainText("including commercial");
    await expect(note).not.toContainText("Free for churches");
    // the sentence used to render twice, the second copy overlapping the grid
    await expect(page.locator(".license-note p")).toHaveCount(1);
    await expect(page.getByTestId("you-may")).toContainText("Sell your own arrangement or recording");
    // nothing is forbidden in the public domain, so the list is gone entirely
    await expect(page.getByTestId("you-may-not")).toHaveCount(0);
    // and nothing is a condition: courtesy credit lives in sources.txt, not in the deed
    await expect(page.getByTestId("you-must")).toHaveCount(0);
    await expect(page.getByTestId("license-badge")).toHaveAttribute("data-license", "PD");
  });

  test("writer-licensed song lists worship use and what stays with the writer", async ({ page, request }) => {
    const draft = await createPendingSong(request, await adminJwt(request), WC_TITLE);
    await approveSubmission(request, (await pendingSubmissionFor(request, draft.assetId)).id);
    await page.goto(`/songs/${draft.assetId}`);
    await expect(page.locator(".license-note")).toContainText("WorshipCommons License v1.0");
    await expect(page.getByTestId("you-may")).toContainText("Record or stream your service");
    await expect(page.getByTestId("you-may-not")).toContainText("Sell recordings or sheet music");
    await expect(page.getByTestId("you-may-not")).toContainText("Change what the song means");
    // WC asks for credit but does not require it
    await expect(page.getByTestId("you-must")).toHaveCount(0);
    await expect(page.getByTestId("license-badge")).toHaveAttribute("data-license", "WC");
  });

  test("the license hub is reachable with and without a trailing slash", async ({ page }) => {
    await page.goto("/license/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("One page. Zero strings.");
    await expect(page.locator("#legal")).toContainText("WorshipCommons License, Version 1.0 — Legal Code");

    await page.goto("/");
    await page.locator(".nav").getByRole("link", { name: "The License" }).click();
    await expect(page).toHaveURL(/\/license\/?$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("One page. Zero strings.");
    await expect(page.getByText("Page not found.")).toHaveCount(0);
  });

  test("a Creative Commons song adds the You must list: credit, license name, link", async ({ page, request }) => {
    await page.goto(`/songs/${await songIdByTitle(request, CC_BY_TITLE)}`);
    const note = page.locator(".license-note");
    await expect(note).toContainText("Creative Commons CC BY");
    await expect(note).not.toContainText("Public domain");
    await expect(page.locator(".license-note p")).toHaveCount(1);
    await expect(page.getByTestId("you-may")).toContainText("Sell your own arrangement or recording");
    await expect(page.getByTestId("you-may-not")).toContainText("Pretend you wrote it");
    const must = page.getByTestId("you-must");
    await expect(must).toContainText("You must");
    await expect(must).toContainText("Credit the writer");
    await expect(must).toContainText("Name the license (CC BY, with its version)");
    await expect(must).toContainText("Keep a link to the license on every copy");
  });
});
