import { test, expect, type Page } from "@playwright/test";
import { songIdByTitle } from "./helpers/api";

let AG = "";

test.beforeAll(async ({ request }) => {
  AG = await songIdByTitle(request, "Amazing Grace");
});

/** The panel lives in the song page's Project mode; switch to it when the page hides it behind a mode tab. */
async function openProjectPanel(page: Page) {
  await page.goto(`/songs/${AG}`);
  await expect(page.getByRole("heading", { name: "Amazing Grace" })).toBeVisible();
  const panel = page.getByTestId("project-panel");
  if (!(await panel.isVisible())) {
    const tab = page.getByRole("tab", { name: /project/i }).or(page.getByRole("button", { name: /^project/i })).or(page.getByRole("link", { name: /^project/i }));
    await tab.first().click();
  }
  await expect(panel).toBeVisible();
  return panel;
}

test.describe("web projector", () => {
  test("shows the first section large, advances with →, blanks with B, keeps the credit", async ({ page }) => {
    await page.goto(`/songs/${AG}/project`);
    const projector = page.getByTestId("projector");
    await expect(page.getByTestId("projector-label")).toHaveText("Verse 1");
    await expect(page.getByTestId("projector-slide")).toContainText("Amazing grace! how sweet the sound,");
    await expect(page.getByTestId("projector-slide")).not.toContainText("[");
    await expect(page.getByTestId("projector-next")).toContainText("Verse 2");
    await expect(page.getByTestId("projector-credit")).toContainText("John Newton");

    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("projector-label")).toHaveText("Verse 2");
    await expect(projector).toHaveAttribute("data-slide", "1");
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByTestId("projector-label")).toHaveText("Verse 1");
    await page.keyboard.press("End");
    await expect(projector).toHaveAttribute("data-slide", "4");
    await page.keyboard.press("Home");
    await expect(projector).toHaveAttribute("data-slide", "0");

    await page.keyboard.press("b");
    await expect(projector).toHaveAttribute("data-blank", "1");
    await expect(page.getByTestId("projector-slide")).toHaveCount(0);
    await page.keyboard.press("b");
    await expect(page.getByTestId("projector-slide")).toBeVisible();

    await page.keyboard.press("h");
    await expect(projector).toHaveClass(/projector-light/);

    // the picker strip jumps straight to a section
    await page.getByTestId("pick-2").click();
    await expect(page.getByTestId("projector-label")).toHaveText("Verse 3");
  });

  test("?order= honours the picked sections and their order", async ({ page }) => {
    await page.goto(`/songs/${AG}/project?order=Verse%203,Verse%201`);
    await expect(page.getByTestId("projector-label")).toHaveText("Verse 3");
    await expect(page.getByTestId("projector-picker").getByRole("tab")).toHaveCount(2);
    await page.getByTestId("projector-stage").click();
    await expect(page.getByTestId("projector-label")).toHaveText("Verse 1");
    await expect(page.getByTestId("projector-next")).toHaveCount(0);
  });

  test("Esc returns to the song page", async ({ page }) => {
    await page.goto(`/songs/${AG}/project`);
    await expect(page.getByTestId("projector-slide")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(new RegExp(`/songs/${AG}$`));
  });
});

test.describe("project panel exports", () => {
  test("opens the projector and downloads FreeShow, OpenLyrics and PPTX files", async ({ page }) => {
    const panel = await openProjectPanel(page);
    await expect(panel.getByTestId("open-projector")).toHaveAttribute("href", `/songs/${AG}/project`);
    await expect(panel.getByTestId("project-note")).toContainText("form map");

    for (const [id, ext] of [["export-freeshow", ".show"], ["export-openlyrics", ".xml"], ["export-pptx", ".pptx"]]) {
      const [download] = await Promise.all([page.waitForEvent("download"), panel.getByTestId(id).click()]);
      expect(download.suggestedFilename(), id).toBe(`amazing-grace${ext}`);
    }
  });

  test("copies an OnSong / Planning Center paste to the clipboard", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const panel = await openProjectPanel(page);
    await panel.getByTestId("export-onsong").click();
    await expect(panel.getByTestId("export-onsong")).toHaveText("Copied ✓");
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text.startsWith("{title: Amazing Grace}")).toBeTruthy();
    expect(text).toContain("{key: G}");
    expect(text).toContain("Verse 1:");
    expect(text).toContain("[G]Amazing grace!");
  });
});
