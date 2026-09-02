import { test, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";
import { pendingSubmissionFor, submissionDetail, WC_API } from "./helpers/api";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRANSLATION_TITLE = "Spec Translation E2E";
const MIDI_TITLE = "Spec Midi Song E2E";

const LYRICS = "Verse 1\n[G]Sing a new song [C]to the [G]Lord,\nall the [Em]earth lift [D]up your [G]voice.";

/** An English original from the seeded catalog, so the translation really has a parent to point at. */
async function englishOriginal(request: import("@playwright/test").APIRequestContext) {
  const list = await (await request.get(`${WC_API}/songs`)).json();
  const song = list.find((s: any) => s.language === "English" && !s.parentSongId && s.title);
  if (!song) throw new Error("No English original in the seeded catalog");
  return song as { id: string; title: string };
}

test.describe.serial("submission type", () => {
  test("a translation records parentSongId and relationLabel", async ({ page, request }) => {
    const parent = await englishOriginal(request);

    await page.goto("/upload");
    await page.getByTestId("submission-type").locator('input[value="translation"]').check();
    await page.getByTestId("parent-search").fill(parent.title);
    const picker = page.getByTestId("parent-song");
    await expect(picker.locator(`option[value="${parent.id}"]`)).toHaveCount(1);
    await picker.selectOption(parent.id);

    await page.fill("#title", TRANSLATION_TITLE);
    await page.fill("#writers", "Playwright Translator");
    await page.fill("#lyrics", LYRICS);
    await page.selectOption("#pro", { index: 1 });
    await page.check("#certify");

    // still English — the form must refuse a translation into the original's own language
    await page.getByRole("button", { name: "Add it to the commons" }).click();
    await expect(page.getByTestId("upload-error")).toContainText("different language");

    await page.selectOption("#lang", "Spanish");
    await page.getByRole("button", { name: "Add it to the commons" }).click();
    await expect(page.getByTestId("upload-thanks")).toBeVisible();

    const pending = await pendingSubmissionFor(request, TRANSLATION_TITLE);
    const detail = await submissionDetail(request, pending.id);
    expect(detail.payload.detail.parentSongId).toBe(parent.id);
    expect(detail.payload.detail.relationLabel).toBe("Translation (Spanish)");
  });

  test("a MIDI melody uploads as tune.mid", async ({ page, request }) => {
    await page.goto("/upload");
    await page.fill("#title", MIDI_TITLE);
    await page.fill("#writers", "Playwright Composer");
    await page.fill("#lyrics", LYRICS);
    await page.getByTestId("file-midi").setInputFiles(path.join(__dirname, "fixtures", "tiny.mid"));
    await expect(page.locator(".dropzone", { hasText: "Attached ✓" })).toContainText("tiny.mid");
    await page.selectOption("#pro", { index: 1 });
    await page.check("#certify");
    await page.getByRole("button", { name: "Add it to the commons" }).click();
    await expect(page.getByTestId("upload-thanks")).toBeVisible();

    const pending = await pendingSubmissionFor(request, MIDI_TITLE);
    const detail = await submissionDetail(request, pending.id);
    const midi = detail.files.find((f: any) => f.name === "tune.mid");
    expect(midi, "tune.mid is on the submission").toBeTruthy();
    expect(midi.sizeBytes).toBeGreaterThan(0);

    const stored = await request.get(midi.url);
    expect(stored.ok()).toBeTruthy();
    expect((await stored.body()).subarray(0, 4).toString()).toBe("MThd");
  });
});
