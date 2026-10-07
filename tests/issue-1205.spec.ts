import { test, expect } from "@playwright/test";
import { checkGrant } from "./helpers/attest";
import path from "path";
import { fileURLToPath } from "url";
import { adminJwt, pendingSubmissionFor, rejectSubmission, WC_API } from "./helpers/api";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SONG_TITLE = "Issue 1205 Returned Draft";

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
