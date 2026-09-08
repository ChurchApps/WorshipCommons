import { test, expect } from "@playwright/test";
import { songIdByTitle } from "./helpers/api";

const ND_CONDITION = "No derivatives: no arrangements, translations, or transposed charts may be distributed";

// The upload allowlist offers WC / CC BY / PD only, so no seeded or uploadable song carries an ND license.
// The switch is driven by rightsMatrix.arrange.allowed, so stub the one page fetch and flip that bit.
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

test.describe("the ND switch", () => {
  test("a no-derivatives song keeps its chart as written: transpose, capo, Nashville, pack and preview are off with the reason", async ({ page, request }) => {
    const id = await songIdByTitle(request, "Amazing Grace");
    await stubNoDerivatives(page);
    await page.goto(`/songs/${id}`);

    await expect(page.getByRole("heading", { name: "Amazing Grace" })).toBeVisible();
    await expect(page.getByTestId("license-badge").first()).toHaveAttribute("data-license", "CC-BY-ND");
    await expect(page.getByTestId("license-badge").first()).toHaveText("CC BY-ND");

    const notice = page.getByTestId("nd-notice");
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("No derivatives");
    await expect(notice).toContainText("Transpose, capo, Nashville numbers");

    // the controls stay on the page but are disabled, each carrying the reason
    await expect(page.locator("#transpose")).toBeDisabled();
    await expect(page.locator("#transpose")).toHaveAttribute("title", /No derivatives/);
    await expect(page.locator("#capo")).toBeDisabled();
    await expect(page.locator("#nashville-toggle")).toBeDisabled();
    await expect(page.getByTestId("transpose-stepper").getByRole("button", { name: "+1" })).toBeDisabled();
    await expect(page.locator(".stanza .seg .c").first()).toHaveText("G");
    await expect(page.locator("#key-label")).toHaveText("G");

    // arrangement downloads and generated audio are off too
    await expect(page.getByTestId("download-pack")).toBeDisabled();
    await expect(page.getByTestId("download-pack")).toHaveAttribute("title", /No derivatives/);
    await expect(page.getByTestId("hero-play")).toBeDisabled();
    await expect(page.getByTestId("hero-play")).toHaveAttribute("title", /No derivatives/);
    // the original-key downloads stay available
    await expect(page.getByRole("link", { name: "ChordPro (.cho)" })).toBeVisible();
  });

  test("the rights matrix and the deed say arranging is not allowed; the Listen preview is off too", async ({ page, request }) => {
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

    // a synthesized preview is a derivative too: no Listen play in the panel either
    await expect(page.getByTestId("hero-play")).toBeDisabled();
  });
});
