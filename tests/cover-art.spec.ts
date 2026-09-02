import { test, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";
import { approveSubmission, pendingSubmissionFor, submissionDetail } from "./helpers/api";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SONG_TITLE = "Cover Art E2E";

test.describe.serial("cover art", () => {
  test("writer attaches cover art and the browser makes both files", async ({ page, request }) => {
    await page.goto("/upload");
    await expect(page.getByRole("heading", { name: "Give the church something to sing" })).toBeVisible();

    await page.fill("#title", SONG_TITLE);
    await page.fill("#writers", "Playwright Painter");
    await page.fill("#lyrics", "Verse 1\n[D]Every valley [G]shall be [D]lifted,\nevery [A]mountain [D]low.");

    await page.getByTestId("file-art").setInputFiles(path.join(__dirname, "fixtures", "tiny.png"));
    // the preview only appears once the canvas has encoded the art in the browser
    await expect(page.locator(".dropzone img.dz-art")).toBeVisible();

    await page.selectOption("#pro", { index: 1 });
    await page.check("#certify");
    await page.getByRole("button", { name: "Add it to the commons" }).click();
    await expect(page.getByTestId("upload-thanks")).toBeVisible();

    const pending = await pendingSubmissionFor(request, SONG_TITLE);
    const detail = await submissionDetail(request, pending.id);
    const names = (detail.files || []).map((f: { name: string }) => f.name);
    expect(names).toContain("art.webp");
    expect(names).toContain("art-thumb.webp");

    // the thumbnail is the small one, and neither file is empty
    const sizes = new Map((detail.files || []).map((f: { name: string; sizeBytes: number }) => [f.name, f.sizeBytes]));
    expect(sizes.get("art-thumb.webp")).toBeGreaterThan(0);
    expect(sizes.get("art-thumb.webp")).toBeLessThan(sizes.get("art.webp") as number);
  });

  test("the approved song shows its art in the library", async ({ page, request }) => {
    const pending = await pendingSubmissionFor(request, SONG_TITLE);
    await approveSubmission(request, pending.id);

    await page.goto("/songs");
    await page.fill("#q", "cover art e2e");
    const row = page.locator(".t-row", { hasText: SONG_TITLE });
    await expect(row).toBeVisible();
    await expect(row.locator("img.art")).toHaveAttribute("src", /art-thumb\.webp/);

    // the thumbnail really serves from the API's content store
    const src = await row.locator("img.art").getAttribute("src");
    const thumb = await page.request.get(src as string);
    expect(thumb.ok()).toBeTruthy();
    expect((await thumb.body()).length).toBeGreaterThan(0);
  });
});
