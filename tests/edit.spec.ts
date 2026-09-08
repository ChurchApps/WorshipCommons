import { test, expect } from "@playwright/test";
import { approveSubmission, pendingSubmissionFor, WC_API } from "./helpers/api";

// titles other specs assert on — leave those alone, this spec renames what it edits
const RESERVED = ["Amazing Grace", "Silent Night", "Stille Nacht", "Noche de Paz", "Abide, O Dearest Jesus", "Adeste Fideles", "Be Thou My Vision"];

test.describe.serial("propose an edit", () => {
  let songId = "";
  let oldTitle = "";
  let newTitle = "";

  test("a contributor proposes a title change", async ({ page, request }) => {
    const songs = await (await request.get(`${WC_API}/songs`)).json();
    const song = songs.find((s: { title: string; chordPro?: string }) => !RESERVED.includes(s.title));
    songId = song.id;
    oldTitle = song.title;
    newTitle = `${song.title} (spec edit)`;

    await page.goto(`/songs/${songId}`);
    await page.getByTestId("propose-edit").click();
    await expect(page).toHaveURL(new RegExp(`/songs/${songId}/edit`));
    await expect(page.getByText("has no veto")).toBeVisible();

    // the form arrives prefilled from the live song
    await expect(page.locator("#title")).toHaveValue(oldTitle);
    await expect(page.locator("#lyrics")).not.toHaveValue("");

    await page.fill("#title", newTitle);
    await page.fill("#edit-note", "Corrected the title.");
    await page.getByRole("button", { name: "Propose this edit" }).click();
    await expect(page.getByTestId("edit-thanks")).toBeVisible();
  });

  test("nothing changes on the public page until a reviewer approves", async ({ page }) => {
    await page.goto(`/songs/${songId}`);
    await expect(page.locator(".song-title")).toHaveText(oldTitle);
  });

  test("a second edit while one is pending is refused", async ({ page }) => {
    await page.goto(`/songs/${songId}/edit`);
    await page.fill("#title", "Should Not Land");
    await page.fill("#edit-note", "Competing edit.");
    await page.getByRole("button", { name: "Propose this edit" }).click();
    await expect(page.getByTestId("upload-error")).toContainText("already under review");
  });

  test("after approval the song carries the edit and the history shows both", async ({ page, request }) => {
    const pending = await pendingSubmissionFor(request, songId);
    expect(pending.isNewAsset).toBeFalsy();
    await approveSubmission(request, pending.id);

    await page.goto(`/songs/${songId}`);
    await expect(page.locator(".song-title")).toHaveText(newTitle);
    await expect(page.getByTestId("history").getByTestId("history-entry")).toHaveCount(2);
    await expect(page.getByTestId("history")).toContainText("Corrected the title.");
  });
});
