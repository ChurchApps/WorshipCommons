import { test, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";
import { approveSubmission, pendingSubmissionFor, submissionDetail, WC_API } from "./helpers/api";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WAV = path.join(__dirname, "fixtures", "tiny.wav");
const SONG_TITLE = "Master Song E2E";
// titles other specs assert on or edit — the add-a-master flow picks a song none of them touch
const RESERVED = ["Amazing Grace", "Silent Night", "Stille Nacht", "Noche de Paz", "Abide, O Dearest Jesus", "Adeste Fideles", "Be Thou My Vision", "Test Song E2E", SONG_TITLE];

const fillComposition = async (page: import("@playwright/test").Page, title: string) => {
  await page.fill("#title", title);
  await page.fill("#writers", "E2E Writer");
  await page.fill("#lyrics", "Verse 1\n[G]Master of the [C]song\n\nChorus\n[D]Sing it [G]out");
};

test.describe.serial("composition and master: two grants, two licenses", () => {
  test("a new song is the composition alone by default; choosing both reveals the master file and its own license", async ({ page }) => {
    await page.goto("/upload");
    const scope = page.getByTestId("scope-choice");
    await expect(scope.locator('input[value="composition"]')).toBeChecked();
    await expect(page.getByTestId("master-step")).toHaveCount(0);
    await expect(page.getByTestId("license-choice").locator('input[name="license"]')).toHaveCount(3);

    await scope.locator('input[value="both"]').check();
    await expect(page.getByTestId("master-step")).toBeVisible();
    await expect(page.getByTestId("file-master")).toHaveCount(1);
    const masterLicense = page.getByTestId("master-license-choice").locator('input[name="masterLicense"]');
    await expect(masterLicense).toHaveCount(3);
    await expect(page.locator('input[name="masterLicense"][value="WC"]')).toBeChecked();
    await expect(page.getByTestId("recording-owned")).toBeVisible();

    // a master without the file does not submit
    await fillComposition(page, "Unfinished master");
    await page.check("#recording-owned");
    await page.check("#certify");
    await page.getByTestId("submit-song").click();
    await expect(page.getByTestId("upload-error")).toContainText("Master recording");
  });

  test("composition CC BY + master PD: both licenses land on the published song", async ({ page, request }) => {
    await page.goto("/upload");
    await fillComposition(page, SONG_TITLE);
    await page.getByTestId("scope-choice").locator('input[value="both"]').check();
    await page.locator('input[name="license"][value="CC-BY"]').check();
    await page.locator('input[name="masterLicense"][value="PD"]').check();
    await page.getByTestId("file-master").setInputFiles(WAV);
    await expect(page.locator(".dropzone", { hasText: "Attached ✓" })).toHaveCount(1);
    await page.check("#recording-owned");
    await page.check("#certify");
    await page.getByTestId("submit-song").click();
    await expect(page.getByTestId("upload-thanks")).toBeVisible({ timeout: 30000 });

    const pending = await pendingSubmissionFor(request, SONG_TITLE);
    const detail = await submissionDetail(request, pending.id);
    expect(detail.payload.license).toBe("CC-BY");
    expect(detail.payload.detail.masterLicense).toBe("PD");
    expect(detail.payload.detail.recordingOwned).toBe(true);
    await approveSubmission(request, pending.id);

    const song = await (await request.get(`${WC_API}/songs/${pending.assetId}`)).json();
    expect(song.license).toBe("CC-BY");
    expect(song.rights.recording).toMatchObject({ license: "PD" });
    expect(song.rights.text).toMatchObject({ license: "CC-BY" });
    expect(song.fileUrls.master).toMatch(/master\.wav$/);

    await page.goto(`/songs/${pending.assetId}`);
    await expect(page.getByTestId("master-audio")).toHaveAttribute("src", /master\.wav$/);
    // one master per song: the add link is gone once it is served
    await expect(page.getByTestId("add-master")).toHaveCount(0);
    await page.getByTestId("tab-about").click();
    const layers = page.getByTestId("rights-layers");
    await expect(layers.locator('[data-layer="recording"] .lic')).toHaveText("PD");
    await expect(layers.locator('[data-layer="text"] .lic')).toHaveText("CC-BY");
  });

  test("an existing composition gains a master from the song page, under its own license", async ({ page, request }) => {
    const songs = await (await request.get(`${WC_API}/songs`)).json();
    // change-proposals takes the last free English song and edit.spec the first; this one takes the second-to-last
    const free = songs.filter((s: any) => !RESERVED.includes(s.title) && s.language === "English" && !s.fileUrls?.master);
    const song = free[free.length - 2];
    expect(song, "a free English song without a master").toBeTruthy();

    await page.goto(`/songs/${song.id}`);
    await page.getByTestId("add-master").click();
    await expect(page).toHaveURL(new RegExp(`/songs/[^/]*${song.id}/edit\\?type=recording`));
    await expect(page.getByTestId("proposal-type").locator('input[value="recording"]')).toBeChecked();
    // a recording proposal is only the master, its license, the attestation and a note — no song fields
    await expect(page.locator("#title")).toHaveCount(0);
    await expect(page.locator('input[name="license"]')).toHaveCount(0);
    await expect(page.getByTestId("master-step")).toBeVisible();

    await page.getByTestId("file-master").setInputFiles(WAV);
    await page.locator('input[name="masterLicense"][value="WC"]').check();
    await page.check("#recording-owned");
    await page.check("#certify");
    await page.fill("#edit-note", "Studio master, mixed in the original key.");
    await page.getByRole("button", { name: "Propose this recording" }).click();
    await expect(page.getByTestId("edit-thanks")).toBeVisible({ timeout: 30000 });

    const pending = await pendingSubmissionFor(request, song.id);
    expect(pending.type).toBe("recording");
    const detail = await submissionDetail(request, pending.id);
    expect(detail.payload.detail.masterLicense).toBe("WC");
    expect(detail.payload.license).toBe(song.license);
    await approveSubmission(request, pending.id);

    const after = await (await request.get(`${WC_API}/songs/${song.id}`)).json();
    expect(after.license).toBe(song.license);
    expect(after.rights.recording).toMatchObject({ license: "WC" });
    expect(after.fileUrls.master).toMatch(/master\.wav$/);
    await page.goto(`/songs/${song.id}`);
    await expect(page.getByTestId("master-audio")).toBeVisible();
    await expect(page.getByTestId("add-master")).toHaveCount(0);
  });
});
