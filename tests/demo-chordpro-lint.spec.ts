import { test, expect } from "@playwright/test";

const CLEAN = "Verse 1\n[D]Every valley shall be [G]lifted,\nand the [A]rough places [D]plain.";
const BROKEN = "Verse 1\n[D]Every valley shall be [G lifted,\nand the [A]rough places [D]plain.";

test.describe("chordpro lint", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/upload");
    await expect(page.getByRole("heading", { name: "Give the church something to sing" })).toBeVisible();
  });

  test("an unmatched bracket is an error, blocks submit, and clears when fixed", async ({ page }) => {
    await page.fill("#title", "ChordPro Lint E2E");
    await page.fill("#writers", "Playwright Linter");
    await page.selectOption("#key", "D");
    await page.fill("#lyrics", BROKEN);

    const lint = page.getByTestId("chordpro-lint");
    await expect(lint).toBeVisible();
    await expect(lint.locator("li.error")).toHaveText(/Line 2 — Unmatched bracket/);

    await page.selectOption("#pro", { index: 1 });
    await page.check("#certify");
    await page.getByRole("button", { name: "Add it to the commons" }).click();
    await expect(page.getByTestId("upload-error")).toContainText("fix the errors listed under the preview");
    await expect(page.getByTestId("upload-thanks")).toHaveCount(0);

    await page.fill("#lyrics", CLEAN);
    await expect(lint).toHaveCount(0);
  });

  test("warnings flag missing sections, out-of-key chords and a stale key directive without blocking", async ({ page }) => {
    const lint = page.getByTestId("chordpro-lint");
    await page.selectOption("#key", "D");

    // nine lines with no section label at all
    await page.fill("#lyrics", Array.from({ length: 9 }, (_, i) => `[D]Line number ${i + 1} of the song`).join("\n"));
    await expect(lint.locator("li")).toHaveText([/No section labels/]);

    // three distinct chords outside D major
    await page.fill("#lyrics", "Verse 1\n[D]Every [F]valley shall be [Bb]lifted,\nand the [Eb]rough places [D]plain.");
    await expect(lint.locator("li")).toHaveText([/Chords outside D: F, Bb, Eb/]);

    // a {key:} directive that disagrees with the key chosen above
    await page.fill("#lyrics", "{key: A}\nVerse 1\n[D]Every valley shall be [G]lifted.");
    await expect(lint.locator("li")).toHaveText([/Line 1 — Key directive A disagrees with the song key D\./]);

    // warnings alone never block: submitting stops on the unanswered society question, not the lyrics
    await page.fill("#title", "ChordPro Lint Warnings E2E");
    await page.fill("#writers", "Playwright Linter");
    await page.check("#certify");
    await page.getByRole("button", { name: "Add it to the commons" }).click();
    const error = page.getByTestId("upload-error");
    await expect(error).toContainText("Collecting societies & licensing admins");
    await expect(error).not.toContainText("fix the errors listed under the preview");
  });
});
