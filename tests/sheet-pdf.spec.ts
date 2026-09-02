import { test, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";
import { approveSubmission, pendingSubmissionFor, songIdByTitle } from "./helpers/api";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SONG_TITLE = "Sheet PDF Spec Song";

test.describe.serial("sheet pdf viewer", () => {
  test("a writer uploads a song with a sheet PDF and a reviewer approves it", async ({ page, request }) => {
    await page.goto("/upload");
    await page.fill("#title", SONG_TITLE);
    await page.fill("#writers", "Playwright Composer");
    await page.fill("#year", "2026");
    await page.selectOption("#key", "C");
    await page.fill("#lyrics", "Verse 1\n[C]Sing a new song [F]to the [C]Lord");
    await page.getByTestId("file-sheet").setInputFiles(path.join(__dirname, "fixtures", "tiny.pdf"));
    await expect(page.locator(".dropzone", { hasText: "Attached ✓" })).toBeVisible();
    await page.selectOption("#pro", { index: 1 });
    await page.check("#certify");
    await page.getByRole("button", { name: "Add it to the commons" }).click();
    await expect(page.getByTestId("upload-thanks")).toBeVisible();

    const pending = await pendingSubmissionFor(request, SONG_TITLE);
    await approveSubmission(request, pending.id);
  });

  test("the song page shows the PDF inline and still offers the download", async ({ page, request }) => {
    await page.goto(`/songs/${await songIdByTitle(request, SONG_TITLE)}`);
    const card = page.getByTestId("sheet-pdf-card");
    await expect(card).toBeVisible();
    const src = await page.getByTestId("sheet-pdf-embed").getAttribute("src");
    expect(src).toMatch(/sheetPdf\.pdf#/);
    // the embed points at a real PDF served from the content store
    const pdf = await page.request.get(src!.split("#")[0]);
    expect(pdf.ok()).toBeTruthy();
    expect(pdf.headers()["content-type"]).toContain("pdf");
    await expect(card.getByRole("link", { name: "Download PDF" })).toHaveAttribute("download", "");
  });

  test("songs without a sheet PDF get no viewer", async ({ page, request }) => {
    await page.goto(`/songs/${await songIdByTitle(request, "Amazing Grace")}`);
    await expect(page.getByRole("heading", { name: "Amazing Grace" })).toBeVisible();
    await expect(page.getByTestId("sheet-pdf-card")).toHaveCount(0);
  });
});
