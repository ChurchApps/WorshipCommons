import { test, expect } from "@playwright/test";
import { songIdByTitle } from "./helpers/api";

const ND_CONDITION = "No derivatives: no arrangements, translations, or transposed charts may be distributed";

// The upload allowlist offers WC / CC BY / PD only, so no seeded or uploadable song carries an ND license.
// Stub the page fetch so the rights matrix forbids arranging — tools on the page must still work.
async function stubNoDerivatives(page: import("@playwright/test").Page) {
  await page.route(/\/commons\/songs\/[^/?]+\/page(\?.*)?$/, async route => {
    const response = await route.fetch();
    const body = await response.json();
    const song = body.song;
    song.license = "CC-BY-ND";
    song.licenseUrl = "https://creativecommons.org/licenses/by-nd/4.0/";
    song.rights = null;
    const matrix = song.rightsMatrix || {};
    for (const use of ["project", "print", "stream", "record"]) matrix[use] = matrix[use] || { allowed: true, conditions: ["Credit the writer and link the license"] };
    matrix.arrange = { allowed: false, conditions: [ND_CONDITION] };
    song.rightsMatrix = matrix;
    await route.fulfill({ response, json: body });
  });
}

test.describe("license does not disable song tools", () => {
  test("an ND grant still leaves transpose, capo, Nashville, pack and preview on", async ({ page, request }) => {
    const id = await songIdByTitle(request, "Amazing Grace");
    await stubNoDerivatives(page);
    await page.goto(`/songs/${id}`);

    await expect(page.getByRole("heading", { name: "Amazing Grace" })).toBeVisible();
    await expect(page.getByTestId("license-badge").first()).toHaveAttribute("data-license", "CC-BY-ND");
    await expect(page.getByTestId("nd-notice")).toHaveCount(0);

    await expect(page.locator("#transpose")).toBeEnabled();
    await expect(page.locator("#capo")).toBeEnabled();
    await expect(page.locator("#nashville-toggle")).toBeEnabled();
    await expect(page.getByTestId("transpose-stepper").getByRole("button", { name: "+1" })).toBeEnabled();
    await expect(page.getByTestId("download-pack")).toBeEnabled();
    await expect(page.getByTestId("hero-play")).toBeEnabled();
  });

  test("the rights matrix still says arranging is not allowed", async ({ page, request }) => {
    const id = await songIdByTitle(request, "Amazing Grace");
    await stubNoDerivatives(page);
    await page.goto(`/songs/${id}`);

    const arrange = page.getByTestId("rights-arrange");
    await expect(arrange).toHaveAttribute("data-allowed", "false");
    await expect(arrange).toContainText("You may not");
    await expect(arrange).toContainText("No derivatives");
    await expect(page.getByTestId("rights-project")).toHaveAttribute("data-allowed", "true");
    await expect(page.getByTestId("license-grant")).toHaveAttribute("data-license", "CC-BY-ND");
    await expect(page.getByTestId("you-may-not")).toContainText("transposed chart");
  });
});
