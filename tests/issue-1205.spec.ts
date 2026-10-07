import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { checkGrant } from "./helpers/attest";
import path from "path";
import { fileURLToPath } from "url";
import { adminJwt, pendingSubmissionFor, rejectSubmission, userJwt, WC_API } from "./helpers/api";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SONG_TITLE = "Issue 1205 Returned Draft";
const WAV = path.join(__dirname, "fixtures", "tiny.wav");

/** the composition and its master, demo and master picked once, ownership vouched */
async function fillBoth(page: Page, title: string) {
  await page.goto("/upload");
  await page.fill("#title", title);
  await page.fill("#writers", "Spec Writer");
  await page.fill("#lyrics", "Verse 1\n[G]Sing a new song [C]to the [G]Lord");
  await page.getByTestId("scope-choice").locator('input[value="both"]').check();
  await page.getByTestId("file-demo").setInputFiles(WAV);
  await page.getByTestId("file-master").setInputFiles(WAV);
  await page.check("#recording-owned");
  await checkGrant(page);
}

/** the draft the page is editing, as its owner sees it */
async function ownDraft(request: APIRequestContext, id: string) {
  const resp = await request.get(`${WC_API}/submissions/${id}`, { headers: { Authorization: `Bearer ${await userJwt(request)}` } });
  return await resp.json();
}

/** the reopened draft shows both uploads in their own boxes and still carries the ownership box */
async function expectBothAttached(page: Page) {
  const demo = page.locator(".dropzone", { has: page.getByTestId("file-demo") });
  const master = page.locator(".dropzone", { has: page.getByTestId("file-master") });
  await expect(demo).toContainText("Attached ✓");
  await expect(demo).toContainText("demoAudio.wav");
  await expect(master).toContainText("Attached ✓");
  await expect(master).toContainText("master.wav");
  await expect(page.locator("#recording-owned")).toBeChecked();
}

test("a returned draft with a demo recording keeps the ownership box through autosave and can be sent again", async ({ page, request }) => {
  await page.goto("/upload");
  await page.fill("#title", SONG_TITLE);
  await page.fill("#writers", "Spec Writer");
  await page.fill("#lyrics", "Verse 1\n[G]Sing a new song [C]to the [G]Lord");
  await page.getByTestId("file-demo").setInputFiles(path.join(__dirname, "fixtures", "tiny.wav"));
  await page.check("#recording-owned");
  await checkGrant(page);
  await page.getByRole("button", { name: "Add it to the commons" }).click();
  await expect(page.getByTestId("upload-thanks")).toBeVisible();

  const pending = await pendingSubmissionFor(request, SONG_TITLE);
  const jwt = await adminJwt(request);
  const resp = await request.post(`${WC_API}/admin/submissions/${pending.id}/request-changes`, { headers: { Authorization: `Bearer ${jwt}` }, data: { note: "Please add a scripture reference." } });
  expect(resp.ok()).toBeTruthy();

  // reopening the draft autosaves it; the reload shows what that save kept
  await page.goto(`/upload?draft=${pending.id}`);
  await expect(page.getByTestId("changes-requested")).toBeVisible();
  await page.fill("#scripture", "Psalm 96:1");
  await expect(page.getByTestId("save-status")).toContainText("Draft saved");
  await page.reload();
  await expect(page.locator("#scripture")).toHaveValue("Psalm 96:1");
  await expect(page.getByTestId("recording-owned")).toBeChecked();

  await page.getByRole("button", { name: "Add it to the commons" }).click();
  await expect(page.getByTestId("upload-thanks")).toBeVisible();

  await rejectSubmission(request, pending.id);
});

test("a never-sent draft with a demo and a master keeps both files through a reload and sends without re-attaching", async ({ page, request }) => {
  const title = "Issue 1205 Unsent Master";
  await fillBoth(page, title);
  await expect(page.getByTestId("save-status")).toContainText("Draft saved");
  await expect(page).toHaveURL(/\?draft=/);
  const id = new URL(page.url()).searchParams.get("draft") as string;
  // the files land on pick and the box with the last autosave
  await expect.poll(async () => {
    const sub = await ownDraft(request, id);
    return { owned: !!sub.payload?.detail?.recordingOwned, files: (sub.files || []).map((f: { name: string }) => f.name).sort() };
  }).toEqual({ owned: true, files: ["demoAudio.wav", "master.wav"] });

  await page.reload();
  await expectBothAttached(page);
  await page.getByRole("button", { name: "Add it to the commons" }).click();
  await expect(page.getByTestId("upload-thanks")).toBeVisible({ timeout: 30000 });

  await rejectSubmission(request, id);
});

test("a returned draft with a demo and a master sends again without re-attaching", async ({ page, request }) => {
  const title = "Issue 1205 Returned Master";
  await fillBoth(page, title);
  await page.getByRole("button", { name: "Add it to the commons" }).click();
  await expect(page.getByTestId("upload-thanks")).toBeVisible({ timeout: 30000 });

  const pending = await pendingSubmissionFor(request, title);
  const jwt = await adminJwt(request);
  const resp = await request.post(`${WC_API}/admin/submissions/${pending.id}/request-changes`, { headers: { Authorization: `Bearer ${jwt}` }, data: { note: "Please add a scripture reference." } });
  expect(resp.ok()).toBeTruthy();

  await page.goto(`/upload?draft=${pending.id}`);
  await expect(page.getByTestId("changes-requested")).toBeVisible();
  await expectBothAttached(page);
  await page.getByRole("button", { name: "Add it to the commons" }).click();
  await expect(page.getByTestId("upload-thanks")).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("recordingOwned")).toHaveCount(0);

  await rejectSubmission(request, pending.id);
});
