import { test, expect } from "@playwright/test";
import { WC_API } from "./helpers/api";

const TITLE = "Polish Spec Draft";

test.describe.serial("upload form polish", () => {
  test("gaps update as you type and link to their field", async ({ page }) => {
    await page.goto("/upload");
    await page.getByTestId("submit-song").click();
    const gaps = page.getByTestId("upload-error");
    await expect(gaps).toContainText("Title");
    await expect(page.locator("#title")).toBeFocused();

    await page.fill("#title", "Gap Spec Title");
    await expect(gaps.getByRole("link", { name: "Title", exact: true })).toHaveCount(0);
    await gaps.getByRole("link", { name: "Writer(s)" }).click();
    await expect(page.locator("#writers")).toBeFocused();
  });

  test("the key follows the first chord until the writer picks one", async ({ page }) => {
    await page.goto("/upload");
    await page.fill("#lyrics", "Verse 1\n[Em]Hold me [C]close");
    await expect(page.locator("#key")).toHaveValue("Em");
    await expect(page.getByTestId("key-detected")).toBeVisible();
    await page.selectOption("#key", "G");
    await page.fill("#lyrics", "Verse 1\n[A]Changed");
    await expect(page.locator("#key")).toHaveValue("G");
  });

  test("an unreadable chord is flagged", async ({ page }) => {
    await page.goto("/upload");
    await page.fill("#lyrics", "Verse 1\n[G]Grace [H]that saved");
    await expect(page.getByTestId("chordpro-lint")).toContainText("[H]");
  });

  test("a file the slot can't take is refused before upload; an attached one can be removed", async ({ page }) => {
    await page.goto("/upload");
    const demo = page.getByTestId("file-demo");
    await demo.setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("x") });
    await expect(page.locator(".dropzone .dz-problem")).toContainText("notes.txt");
    await demo.setInputFiles({ name: "demo.mp3", mimeType: "audio/mpeg", buffer: Buffer.alloc(26 * 1024 * 1024) });
    await expect(page.locator(".dropzone .dz-problem")).toContainText("limit here is 25 MB");
    await demo.setInputFiles({ name: "demo.mp3", mimeType: "audio/mpeg", buffer: Buffer.alloc(2048) });
    await expect(page.locator(".dropzone", { hasText: "Attached ✓" })).toContainText("demo.mp3");
    await expect(page.getByTestId("recording-owned")).toBeVisible();
    await page.getByTestId("file-demo-clear").click();
    await expect(page.locator(".dropzone", { hasText: "Attached ✓" })).toHaveCount(0);
    await expect(page.getByTestId("recording-owned")).toHaveCount(0);
  });

  test("a file dropped beside a drop zone does not leave the page", async ({ page }) => {
    await page.goto("/upload");
    const prevented = await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.items.add(new File(["x"], "a.mp3", { type: "audio/mpeg" }));
      const ev = new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true });
      document.querySelector("h1")!.dispatchEvent(ev);
      return ev.defaultPrevented;
    });
    expect(prevented).toBe(true);
  });

  test("a translation is not warned against its own original", async ({ page }) => {
    await page.goto("/upload");
    await page.locator('input[name="submission-type"][value="translation"]').check();
    await page.getByTestId("parent-search").fill("Amazing Grace");
    const option = page.getByTestId("parent-song").locator("option", { hasText: "Amazing Grace" }).first();
    await expect(option).toBeAttached();
    await page.getByTestId("parent-song").selectOption(await option.getAttribute("value") as string);
    await page.fill("#title", "Amazing Grace");
    await page.fill("#writers", "John Newton");
    await page.waitForTimeout(1200);
    await expect(page.getByTestId("duplicate-warning")).toHaveCount(0);
  });

  test("the draft id lands in the URL, and My submissions can delete it", async ({ page }) => {
    await page.goto("/upload");
    await page.fill("#title", TITLE);
    await expect(page).toHaveURL(/\/upload\?draft=/, { timeout: 10000 });
    await expect(page.getByTestId("save-status")).toContainText("Draft saved");
    const draftUrl = page.url();
    await page.reload();
    await expect(page.locator("#title")).toHaveValue(TITLE);
    expect(page.url()).toBe(draftUrl);

    await page.goto("/my-songs");
    await page.getByTestId("my-song-tabs").getByRole("tab", { name: /Drafts/ }).click();
    const row = page.getByTestId("my-song").filter({ hasText: TITLE });
    await expect(row).toHaveCount(1);
    await row.getByTestId("delete-draft").click();
    await row.getByTestId("delete-draft-confirm").click();
    await expect(page.getByTestId("my-song").filter({ hasText: TITLE })).toHaveCount(0);
  });

  test("a correction can't relicense the song or claim authorship", async ({ page, request }) => {
    const songs = await (await request.get(`${WC_API}/songs`)).json();
    const song = songs.find((s: { license: string; language: string }) => s.license === "PD" && s.language === "English");
    await page.goto(`/songs/${song.id}/edit`);
    await expect(page.getByTestId("license-locked")).toContainText("Only the writer");
    await expect(page.locator('input[name="license"]')).toHaveCount(0);
    await expect(page.locator(".dropzone")).toHaveCount(0);
    await expect(page.getByTestId("certifyWrote")).toHaveCount(0);
    await expect(page.getByTestId("contributionAgreed")).not.toBeChecked();
  });
});
