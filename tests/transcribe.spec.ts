import { test, expect } from "@playwright/test";
import { WC_API } from "./helpers/api";

const TINY_ABC = "X:1\nT:Spec Tune\nM:4/4\nL:1/4\nK:C\nC D E F | G4 |\n";

test.describe("transcribe flow", () => {
  test("draft from MIDI, engrave, submit, reject in admin", async ({ page, request }) => {
    // any approved song with a MIDI but no ABC is a transcription target
    const songs = await (await request.get(`${WC_API}/songs`)).json();
    const song = songs.find((s: { fileUrls?: Record<string, string> }) => s.fileUrls?.midi && !s.fileUrls?.abc);
    test.skip(!song, "no MIDI-only song in the seed catalog");

    await page.goto(`/songs/${song.id}`);
    await page.getByTestId("transcribe-link").click();
    await expect(page).toHaveURL(new RegExp(`/songs/${song.id}/transcribe`));

    // exercises parseMidi + draftAbc end-to-end against a real seed MIDI
    await page.getByTestId("abc-draft").click();
    await expect(page.getByTestId("abc-editor")).not.toHaveValue("", { timeout: 15000 });
    await expect(page.getByTestId("abc-paper").locator("svg")).toBeVisible();

    // submit a known-good tiny tune so the admin check isn't hostage to draft quality
    await page.getByTestId("abc-editor").fill(TINY_ABC);
    await expect(page.getByTestId("abc-paper").locator("svg")).toBeVisible();
    await page.getByTestId("abc-submit").click();
    await expect(page.getByText("submitted for review")).toBeVisible();

    // reject so repeated runs don't accumulate approved rows
    await page.goto("/admin");
    const card = page.getByTestId("abc-submission").filter({ hasText: song.title });
    await expect(card.first()).toBeVisible();
    await card.first().getByRole("button", { name: "Reject" }).click();
    await expect(card).toHaveCount(0);
  });

  test("song with a score points to the sheet instead", async ({ page, request }) => {
    const songs = await (await request.get(`${WC_API}/songs`)).json();
    const song = songs.find((s: { fileUrls?: Record<string, string> }) => s.fileUrls?.abc);
    test.skip(!song, "no ABC song in the seed catalog");
    await page.goto(`/songs/${song.id}/transcribe`);
    await expect(page.getByText("already has an engraved score")).toBeVisible();
  });
});
