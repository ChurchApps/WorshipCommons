import { test, expect } from "@playwright/test";
import { checkGrant } from "./helpers/attest";
import { WC_API } from "./helpers/api";

test.describe("CCLI number on song pages and upload", () => {
  test("a public-domain hymn with a SongSelect id shows the number and optional-report copy", async ({ page, request }) => {
    const rows: { id: string; title: string; license: string }[] = await (await request.get(`${WC_API}/songs`)).json();
    const grace = rows.find(s => s.title === "Amazing Grace" && s.license === "PD") || rows.find(s => s.title === "Amazing Grace");
    test.skip(!grace, "Amazing Grace is not in the seed");
    const detail = await (await request.get(`${WC_API}/songs/${grace!.id}`)).json();
    test.skip(!detail.ccli, "Amazing Grace is not stamped with a CCLI number");
    const song = grace;

    await page.goto(`/songs/${song!.id}`);
    await expect(page.getByTestId("ccli-badge")).toHaveText(`CCLI ${detail.ccli}`);
    await expect(page.getByTestId("ccli-line")).toContainText(detail.ccli);
    await expect(page.getByTestId("ccli-line")).toContainText("optional");
    await expect(page.getByTestId("ccli-footnote")).toContainText(detail.ccli);
    await expect(page.getByTestId("ccli-footnote")).toContainText("Keep CCLI");
  });

  test("new-song form has an optional CCLI field that stays empty", async ({ page }) => {
    await page.goto("/upload");
    const field = page.getByTestId("ccli-number");
    await expect(field).toBeVisible();
    await expect(field).toHaveValue("");
    await expect(page.getByText("If churches already report this song to CCLI", { exact: false })).toBeVisible();
  });

  test("a too-short CCLI number is blocked before submit", async ({ page }) => {
    await page.goto("/upload");
    await page.fill("#title", "CCLI Field Check");
    await page.fill("#writers", "Test Writer");
    await page.fill("#lyrics", "Verse 1\n[G]Sing a line of praise.");
    await page.getByTestId("ccli-number").fill("12");
    await checkGrant(page);
    await page.getByTestId("submit-song").click();
    await expect(page.getByTestId("upload-error")).toContainText("CCLI number must be 4–8 digits");
    await expect(page.getByTestId("upload-thanks")).toHaveCount(0);
  });
});
