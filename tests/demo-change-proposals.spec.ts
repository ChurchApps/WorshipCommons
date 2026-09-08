import { test, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";
import { adminJwt, mySubmissionFor, pendingSubmissionFor, rejectSubmission, submissionDetail, WC_API } from "./helpers/api";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// titles other specs assert on or edit — this spec proposes changes to a song none of them touch
const RESERVED = [
  "Amazing Grace", "Silent Night", "Stille Nacht", "Noche de Paz", "Abide, O Dearest Jesus", "Adeste Fideles", "Be Thou My Vision", "Test Song E2E"
];
const CHANGES_NOTE = "Please keep the original spelling of the second verse.";

async function requestChanges(request: import("@playwright/test").APIRequestContext, id: string, note: string) {
  const jwt = await adminJwt(request);
  const resp = await request.post(`${WC_API}/admin/submissions/${id}/request-changes`, { headers: { Authorization: `Bearer ${jwt}` }, data: { note } });
  expect(resp.ok(), `request-changes ${id}: ${resp.status()}`).toBeTruthy();
}

test.describe.serial("change proposals", () => {
  let songId = "";
  let title = "";

  test.beforeAll(async ({ request }) => {
    // edit.spec takes the first free song; this spec takes the last so neither leaves a pending proposal in the other's way
    const songs = await (await request.get(`${WC_API}/songs`)).json();
    const song = [...songs].reverse().find((s: { title: string; language: string }) => !RESERVED.includes(s.title) && s.language === "English");
    if (!song) throw new Error("No free English song in the seeded catalog");
    songId = song.id;
    title = song.title;
  });

  test("a correction needs a ten-character note and lands as type correction", async ({ page, request }) => {
    await page.goto(`/songs/${songId}/edit`);
    await expect(page.getByTestId("proposal-type").locator('input[value="correction"]')).toBeChecked();
    await expect(page.locator("#title")).toHaveValue(title);

    await page.fill("#scripture", "Psalm 100:1");
    const submit = page.getByRole("button", { name: "Propose this edit" });
    await page.fill("#edit-note", "Fixed it");
    await expect(page.getByTestId("note-count")).toContainText("8 of 10");
    await expect(submit).toBeDisabled();

    await page.fill("#edit-note", "Corrected the scripture reference.");
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page.getByTestId("edit-thanks")).toBeVisible();

    const mine = await mySubmissionFor(request, title);
    expect(mine.type).toBe("correction");
    expect(mine.status).toBe("pending");
    const detail = await submissionDetail(request, mine.id);
    expect(detail.payload.type).toBe("correction");
    expect(detail.payload.detail.scripture).toBe("Psalm 100:1");
  });

  test("after a reviewer requests changes, /my-songs says so and Continue reopens the draft", async ({ page, request }) => {
    const pending = await pendingSubmissionFor(request, songId);
    await requestChanges(request, pending.id, CHANGES_NOTE);

    await page.goto("/my-songs");
    const row = page.getByTestId("my-song").filter({ hasText: title }).first();
    await expect(row.getByTestId("my-song-status")).toHaveText("Changes requested");
    await expect(row.getByTestId("my-song-type")).toHaveText("Correction");
    await expect(row.getByTestId("review-note")).toHaveText(CHANGES_NOTE);
    await row.getByTestId("continue-draft").click();

    await expect(page).toHaveURL(new RegExp(`/songs/${songId}/edit\\?draft=${pending.id}`));
    await expect(page.getByTestId("changes-requested")).toContainText(CHANGES_NOTE);
    await expect(page.getByTestId("proposal-type").locator('input[value="correction"]')).toBeChecked();
    await expect(page.locator("#edit-note")).toHaveValue("Corrected the scripture reference.");
    await expect(page.locator("#scripture")).toHaveValue("Psalm 100:1");

    // resubmitting the same draft sends it back to review instead of opening a second one
    await page.fill("#edit-note", "Corrected the scripture reference, spelling kept.");
    await page.getByRole("button", { name: "Propose this edit" }).click();
    await expect(page.getByTestId("edit-thanks")).toBeVisible();
    const again = await pendingSubmissionFor(request, songId);
    expect(again.id).toBe(pending.id);
    expect(again.note).toBe("Corrected the scripture reference, spelling kept.");

    await rejectSubmission(request, pending.id);
  });

  test("an additional-file proposal uploads lyrics.cho and edits nothing else", async ({ page, request }) => {
    await page.goto(`/songs/${songId}/edit?type=additionalFile`);
    await expect(page.getByTestId("proposal-type").locator('input[value="additionalFile"]')).toBeChecked();
    await expect(page.locator("#title")).toHaveCount(0);
    await expect(page.getByTestId("file-score")).toBeAttached();
    await expect(page.getByTestId("file-score-image")).toBeAttached();

    await page.getByTestId("file-lyrics").setInputFiles(path.join(__dirname, "fixtures", "tiny.cho"));
    await expect(page.locator(".dropzone", { hasText: "Attached ✓" })).toContainText("tiny.cho");
    await page.fill("#edit-note", "Plain ChordPro of the lyrics for projection.");
    await page.check("#certify");
    await page.getByRole("button", { name: "Propose these files" }).click();
    await expect(page.getByTestId("edit-thanks")).toBeVisible();

    const pending = await pendingSubmissionFor(request, songId);
    expect(pending.type).toBe("additionalFile");
    const detail = await submissionDetail(request, pending.id);
    const lyrics = detail.files.find((f: { name: string }) => f.name === "lyrics.cho");
    expect(lyrics, "lyrics.cho is on the submission").toBeTruthy();
    expect(lyrics.sizeBytes).toBeGreaterThan(0);
    expect(detail.payload.name).toBe(title);

    await page.goto("/my-songs");
    const row = page.getByTestId("my-song").filter({ hasText: title }).first();
    await expect(row.getByTestId("my-song-type")).toHaveText("Additional file");
    await expect(row.getByTestId("my-song-status")).toHaveText("In review");

    await rejectSubmission(request, pending.id);
  });

  test("a removal request is a note alone and lands as type removal", async ({ page, request }) => {
    // /my-songs links approved rows here; this song was not published by the demo user, so go straight there
    await page.goto(`/songs/${songId}/edit?type=removal`);
    await expect(page.getByTestId("proposal-type").locator('input[value="removal"]')).toBeChecked();
    await expect(page.getByTestId("removal-warning")).toBeVisible();
    await expect(page.locator("#title")).toHaveCount(0);
    await expect(page.locator(".dropzone")).toHaveCount(0);

    const submit = page.getByRole("button", { name: "Request removal" });
    await expect(submit).toBeDisabled();
    await page.fill("#edit-note", "This song was published by mistake and must come down.");
    await submit.click();
    await expect(page.getByTestId("edit-thanks")).toBeVisible();

    const pending = await pendingSubmissionFor(request, songId);
    expect(pending.type).toBe("removal");
    const detail = await submissionDetail(request, pending.id);
    expect(detail.payload.type).toBe("removal");
    expect(detail.files).toHaveLength(0);

    await page.goto("/my-songs");
    const row = page.getByTestId("my-song").filter({ hasText: title }).first();
    await expect(row.getByTestId("my-song-type")).toHaveText("Removal request");

    await rejectSubmission(request, pending.id);
  });
});
