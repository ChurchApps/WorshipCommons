import { test, expect } from "@playwright/test";
import * as fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { approveSubmission, CONTENT, mySubmissionFor, pendingSubmissionFor, rejectSubmission, submissionDetail, userJwt, WC_API } from "./helpers/api";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WAV = path.join(__dirname, "fixtures", "tiny.wav");
const PDF = path.join(__dirname, "fixtures", "tiny.pdf");
const ZIP = path.join(__dirname, "fixtures", "tiny.zip");

const LYRICS = "Verse 1\n[G]Sing a new song [C]to the [G]Lord,\nall the [Em]earth lift [D]up your [G]voice.\n\nChorus\n[C]Glory, [D]glory to the [G]King,\n[C]let the [D]whole creation [G]sing.";

async function fillSongFields(page: import("@playwright/test").Page, title: string, themes = ["Praise", "Hope"]) {
  await page.fill("#title", title);
  await page.fill("#writers", "Playwright Composer");
  await page.fill("#year", "2026");
  await page.selectOption("#key", "G");
  await page.fill("#bpm", "90");
  for (const th of themes) await page.getByTestId("theme-chips").getByRole("button", { name: th, exact: true }).click();
  await page.fill("#scripture", "Psalm 96:1");
  await page.fill("#lyrics", LYRICS);
  await page.selectOption("#pro", { index: 1 });
}

test.describe("upload sign-in gate", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("unauthenticated /upload asks the writer to sign in", async ({ page }) => {
    await page.goto("/upload");
    await expect(page).toHaveURL(/\/login\?next=%2Fupload/);
    await expect(page.getByRole("heading", { name: "Join the commons" })).toBeVisible();
    await expect(page.getByTestId("signin-link")).toBeVisible();
  });
});

test.describe("upload required fields", () => {
  test("missing title cannot submit", async ({ page }) => {
    await page.goto("/upload");
    await page.fill("#writers", "Playwright Composer");
    await page.fill("#lyrics", LYRICS);
    await page.selectOption("#pro", { index: 1 });
    await page.check("#certify");
    await page.getByRole("button", { name: "Add it to the commons" }).click();
    await expect(page.getByTestId("upload-thanks")).toHaveCount(0);
    await expect(page).toHaveURL(/\/upload/);
  });

  test("missing lyrics cannot submit", async ({ page }) => {
    await page.goto("/upload");
    await page.fill("#title", "Missing Lyrics Song");
    await page.fill("#writers", "Playwright Composer");
    await page.selectOption("#pro", { index: 1 });
    await page.check("#certify");
    await page.getByRole("button", { name: "Add it to the commons" }).click();
    await expect(page.getByTestId("upload-thanks")).toHaveCount(0);
    await expect(page).toHaveURL(/\/upload/);
  });

  test("missing certify cannot submit", async ({ page }) => {
    await page.goto("/upload");
    await fillSongFields(page, "Missing Certify Song");
    await page.getByRole("button", { name: "Add it to the commons" }).click();
    await expect(page.getByTestId("upload-thanks")).toHaveCount(0);
    await expect(page).toHaveURL(/\/upload/);
  });

  test("demo without recording-owned fails; lyrics-only does not need it", async ({ page }) => {
    await page.goto("/upload");
    await fillSongFields(page, "No Recording Owned");
    await page.getByTestId("file-demo").setInputFiles(WAV);
    await expect(page.getByTestId("recording-owned")).toBeVisible();
    await page.check("#certify");
    await page.getByRole("button", { name: "Add it to the commons" }).click();
    await expect(page.getByTestId("upload-thanks")).toHaveCount(0);

    await page.goto("/upload");
    await fillSongFields(page, "Lyrics Only No Demo");
    await expect(page.getByTestId("recording-owned")).toHaveCount(0);
    await page.check("#certify");
    await page.getByRole("button", { name: "Add it to the commons" }).click();
    await expect(page.getByTestId("upload-thanks")).toBeVisible();
  });

  test("API refuses a demo without the recordingOwned attestation", async ({ request }) => {
    const jwt = await userJwt(request);
    const headers = { Authorization: `Bearer ${jwt}` };
    const draft = await (await request.post(`${WC_API}/submissions`, {
      headers,
      data: { assetType: "song", payload: { name: "API Demo Without Flag", language: "English", license: "WC", detail: { writer: "Spec Writer", songKey: "C", chordPro: "Verse 1\n[C]A line", certified: true } } }
    })).json();
    const stored = await request.post(`${WC_API}/submissions/${draft.submissionId}/files`, {
      headers,
      data: { name: "demoAudio.wav", contentType: "audio/wav", base64: fs.readFileSync(WAV).toString("base64") }
    });
    expect(stored.ok()).toBeTruthy();

    const resp = await request.post(`${WC_API}/submissions/${draft.submissionId}/submit`, { headers, data: {} });
    expect(resp.status()).toBe(400);
    expect(JSON.stringify(await resp.json())).toContain("recordingOwned");
    await request.delete(`${WC_API}/submissions/${draft.submissionId}`, { headers });
  });
});

test.describe.serial("pending is private then reject deletes files", () => {
  const TITLE = "Pending Private Demo Song";
  let submissionId = "";
  let assetId = "";
  let pendingAudioSrc = "";

  test("after upload, public list and guessed content URLs hide the demo", async ({ page, request }) => {
    await page.goto("/upload");
    await fillSongFields(page, TITLE);
    await page.getByTestId("file-demo").setInputFiles(WAV);
    await page.check("#recording-owned");
    await page.check("#certify");
    await page.getByRole("button", { name: "Add it to the commons" }).click();
    await expect(page.getByTestId("upload-thanks")).toBeVisible();

    const list = await (await request.get(`${WC_API}/songs`)).json();
    expect(list.find((s: { title: string }) => s.title === TITLE)).toBeFalsy();

    await page.goto("/my-songs");
    await expect(page.getByTestId("my-song").filter({ hasText: TITLE })).toContainText("In review");

    const mine = await mySubmissionFor(request, TITLE);
    submissionId = mine.id;
    assetId = mine.assetId;
    expect((await request.get(`${WC_API}/songs/${assetId}`)).status()).toBe(404);
    expect((await request.get(`${WC_API}/songs/${assetId}/chordpro`)).status()).toBe(404);
    expect((await request.get(`${WC_API}/songs/${assetId}/lyrics`)).status()).toBe(404);

    // neither the pending key nor the live key is publicly reachable while it waits
    expect((await request.get(`${CONTENT}/pending/${submissionId}/demoAudio.wav`)).status()).not.toBe(200);
    expect((await request.get(`${CONTENT}/assets/song/${assetId}/demoAudio.wav`)).status()).not.toBe(200);

    // the reviewer hears it through a signed, expiring url instead
    const detail = await submissionDetail(request, submissionId);
    pendingAudioSrc = detail.files[0].url;
    expect(pendingAudioSrc).toBeTruthy();
    expect((await request.get(pendingAudioSrc)).ok()).toBeTruthy();
  });

  test("reject removes the song and pending file URLs 404", async ({ page, request }) => {
    await rejectSubmission(request, submissionId);

    await page.goto("/songs");
    await page.fill("#q", TITLE.toLowerCase());
    await expect(page.getByText("Nothing matches yet")).toBeVisible();

    const list = await (await request.get(`${WC_API}/songs`)).json();
    expect(list.find((s: { title: string }) => s.title === TITLE)).toBeFalsy();

    expect((await request.get(pendingAudioSrc)).status()).toBe(404);
    expect((await request.get(`${CONTENT}/pending/${submissionId}/demoAudio.wav`)).status()).not.toBe(200);
  });

  test("my songs shows the reviewer's note", async ({ page }) => {
    await page.goto("/my-songs");
    const card = page.getByTestId("my-song").filter({ hasText: TITLE });
    await expect(card).toContainText("Not accepted");
    await expect(card.getByTestId("review-note")).toContainText("spec");
  });
});

test.describe.serial("approved song is complete — sheet, stems, WC license", () => {
  const TITLE = "Complete WC Upload Song";
  let songId = "";

  test("writer uploads wav, sheet, and stems as Free for worship", async ({ page }) => {
    await page.goto("/upload");
    await fillSongFields(page, TITLE, ["Advent", "Comfort"]);
    await expect(page.locator('input[name="license"][value="WC"]')).toBeChecked();
    await page.getByTestId("file-demo").setInputFiles(WAV);
    await page.getByTestId("file-sheet").setInputFiles(PDF);
    await page.getByTestId("file-stems").setInputFiles(ZIP);
    await page.check("#recording-owned");
    await page.check("#certify");
    await page.getByRole("button", { name: "Add it to the commons" }).click();
    await expect(page.getByTestId("upload-thanks")).toBeVisible();
  });

  test("a reviewer approves", async ({ request }) => {
    const pending = await pendingSubmissionFor(request, TITLE);
    await approveSubmission(request, pending.id);
    const mine = await mySubmissionFor(request, TITLE);
    expect(mine.status).toBe("approved");
    songId = mine.assetId;
  });

  test("public page has chart, writer, themes, WC label, demo, sheet, stems, downloads", async ({ page, request }) => {
    await page.goto("/songs");
    await page.fill("#q", TITLE.toLowerCase());
    const row = page.locator(".t-row", { hasText: TITLE });
    await expect(row).toBeVisible();
    await row.getByRole("link").click();

    await expect(page.getByRole("heading", { name: TITLE })).toBeVisible();
    await expect(page.locator(".stanza-label", { hasText: "Chorus" })).toBeVisible();
    await expect(page.locator(".byline")).toContainText("Playwright Composer");
    await expect(page.locator(".s-tag", { hasText: "Advent" })).toBeVisible();
    await expect(page.locator(".hero-badge")).toContainText(/Free for (worship|churches)/);
    await expect(page.locator(".hero-badge")).not.toContainText("Public domain");
    await expect(page.locator(".sheet .pd-badge")).toHaveCount(0);
    await expect(page.getByText(/copyright-cleared/i)).toHaveCount(0);

    await expect(page.getByTestId("demo-audio")).toHaveAttribute("src", /demoAudio\.wav/);
    const src = await page.getByTestId("demo-audio").getAttribute("src");
    const audio = await request.get(src as string);
    expect(audio.ok()).toBeTruthy();
    expect((await audio.body()).length).toBeGreaterThan(1000);

    const sheet = page.locator("a[download]", { hasText: "Sheet music (PDF)" });
    await expect(sheet).toBeVisible();
    expect((await request.get(await sheet.getAttribute("href") as string)).ok()).toBeTruthy();

    const stems = page.locator(".mt-zip");
    await expect(stems).toBeVisible();
    expect((await request.get(await stems.getAttribute("href") as string)).ok()).toBeTruthy();

    const cho = await request.get(`${WC_API}/songs/${songId}/chordpro`);
    expect(cho.ok()).toBeTruthy();
    expect(await cho.text()).toContain(`{title: ${TITLE}}`);

    const lyr = await request.get(`${WC_API}/songs/${songId}/lyrics`);
    expect(lyr.ok()).toBeTruthy();
    const lyrText = await lyr.text();
    expect(lyrText).toContain("Sing a new song");
    expect(lyrText).not.toContain("[");
  });
});

test.describe.serial("PD submit label", () => {
  const TITLE = "Complete PD Upload Song";

  test("writer uploads as Public domain", async ({ page }) => {
    await page.goto("/upload");
    await fillSongFields(page, TITLE);
    await page.check('input[name="license"][value="PD"]');
    await page.check("#certify");
    await page.getByRole("button", { name: "Add it to the commons" }).click();
    await expect(page.getByTestId("upload-thanks")).toBeVisible();
  });

  test("a reviewer approves the PD song", async ({ request }) => {
    const pending = await pendingSubmissionFor(request, TITLE);
    await approveSubmission(request, pending.id);
  });

  test("public page label is Public domain, never copyright-cleared", async ({ page }) => {
    await page.goto("/songs");
    await page.fill("#q", TITLE.toLowerCase());
    const row = page.locator(".t-row", { hasText: TITLE });
    await expect(row).toBeVisible();
    await expect(row.locator(".pd-badge")).toHaveText("Public domain");
    await row.getByRole("link").click();
    await expect(page.getByRole("heading", { name: TITLE })).toBeVisible();
    await expect(page.locator(".hero-badge")).toContainText("Public domain");
    await expect(page.locator(".hero-badge")).not.toContainText(/Free for (worship|churches)/);
    await expect(page.getByText(/copyright-cleared/i)).toHaveCount(0);
  });
});
