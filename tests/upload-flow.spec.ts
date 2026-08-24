import { test, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SONG_TITLE = "Test Song E2E";

test.describe.serial("upload flow", () => {
  test("writer uploads a song and it lands in review", async ({ page }) => {
    await page.goto("/upload");
    await expect(page.getByRole("heading", { name: "Give the church something to sing" })).toBeVisible();

    await page.fill("#title", SONG_TITLE);
    await page.fill("#writers", "Playwright Composer");
    await page.fill("#year", "2026");
    await page.selectOption("#key", "G");
    await page.fill("#bpm", "90");
    await page.fill("#themes", "Praise, Hope");
    await page.fill("#scripture", "Psalm 96:1");
    await page.fill("#lyrics", "Verse 1\n[G]Sing a new song [C]to the [G]Lord,\nall the [Em]earth lift [D]up your [G]voice.\n\nChorus\n[C]Glory, [D]glory to the [G]King,\n[C]let the [D]whole creation [G]sing.");

    await page.getByTestId("file-demo").setInputFiles(path.join(__dirname, "fixtures", "tiny.wav"));
    await expect(page.locator(".dropzone", { hasText: "Attached ✓" })).toBeVisible();

    await page.check("#recording-owned");
    await page.selectOption("#pro", { index: 1 });
    await page.check("#certify");
    await page.getByRole("button", { name: "Add it to the commons" }).click();

    await expect(page.getByTestId("upload-thanks")).toBeVisible();

    await page.goto("/my-songs");
    await expect(page.getByTestId("my-song").filter({ hasText: SONG_TITLE })).toContainText("In review");
  });

  test("admin sees it pending and approves it", async ({ page }) => {
    await page.goto("/admin");
    const card = page.getByTestId("pending-song").filter({ hasText: SONG_TITLE });
    await expect(card).toBeVisible();
    await expect(card).toContainText("Playwright Composer");

    await card.getByRole("button", { name: "Approve" }).click();
    await expect(card).toHaveCount(0);
    await expect(page.getByTestId("no-pending")).toBeVisible();

    await page.goto("/my-songs");
    await expect(page.getByTestId("my-song").filter({ hasText: SONG_TITLE })).toContainText("Live");
  });

  test("approved song appears in the library with working page and audio", async ({ page }) => {
    await page.goto("/songs");
    await page.fill("#q", "test song e2e");
    const row = page.locator(".t-row", { hasText: SONG_TITLE });
    await expect(row).toBeVisible();

    await row.getByRole("link").click();
    await expect(page.getByRole("heading", { name: SONG_TITLE })).toBeVisible();
    await expect(page.locator(".stanza-label", { hasText: "Chorus" })).toBeVisible();
    await expect(page.getByTestId("demo-audio")).toHaveAttribute("src", /demoAudio\.wav/);

    // uploaded demo really serves from the API's content store
    const src = await page.getByTestId("demo-audio").getAttribute("src");
    const audio = await page.request.get(src);
    expect(audio.ok()).toBeTruthy();
    expect((await audio.body()).length).toBeGreaterThan(1000);
  });
});
