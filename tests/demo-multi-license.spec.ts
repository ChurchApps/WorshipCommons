import { test, expect } from "@playwright/test";
import { songIdByTitle } from "./helpers/api";

// A harvested CC BY 3.0 song from the catalog (C. Michael Pilato, github.com/cmpilato/worship-music).
const CC_TITLE = "Home";

test.describe("six licenses: deeds, upload choices, library facet", () => {
  test("a CC BY song page carries the credit condition, the CC badge and the exact license link", async ({ page, request }) => {
    await page.goto(`/songs/${await songIdByTitle(request, CC_TITLE)}`);
    await expect(page.getByTestId("license-badge")).toHaveAttribute("data-license", "CC-BY");
    await expect(page.getByTestId("license-badge")).toHaveText("CC BY");
    const grant = page.getByTestId("license-grant");
    await expect(grant).toHaveAttribute("data-license", "CC-BY");
    await expect(grant).toContainText("Creative Commons CC BY");
    await expect(grant).toContainText("credit the writer");
    await expect(grant.locator("a[rel~='license']")).toHaveAttribute("href", /creativecommons\.org\/licenses\/by\//);
    // three lists: the deed omits nothing for BY
    await expect(page.getByTestId("you-may")).toContainText("Sell your own arrangement or recording");
    await expect(page.getByTestId("you-may-not")).toContainText("Remove the credit");
    await expect(page.getByTestId("you-must")).toContainText("Credit the writer");
    await expect(page.getByTestId("you-must")).toContainText("Keep a link to the license");
    await expect(grant).not.toContainText("Public domain");
    await expect(grant).not.toContainText("WorshipCommons License");
  });

  test("public-domain and WorshipCommons pages have no You must list", async ({ page, request }) => {
    await page.goto(`/songs/${await songIdByTitle(request, "Amazing Grace")}`);
    await expect(page.getByTestId("license-grant")).toHaveAttribute("data-license", "PD");
    await expect(page.getByTestId("you-must")).toHaveCount(0);
    await expect(page.getByTestId("you-may-not")).toHaveCount(0);
  });

  test("upload offers exactly the three uploadable licenses, CC BY with its own recap and certify hint", async ({ page }) => {
    await page.goto("/upload");
    const choice = page.getByTestId("license-choice");
    await expect(choice.locator('input[name="license"]')).toHaveCount(3);
    await expect(choice.locator('input[name="license"][value="WC"]')).toBeChecked();
    await expect(choice.locator('input[name="license"][value="CC-BY"]')).toHaveCount(1);
    await expect(choice.locator('input[name="license"][value="PD"]')).toHaveCount(1);
    // harvest-only licenses are never offered to a writer
    await expect(choice.locator('input[name="license"][value="CC-BY-NC"]')).toHaveCount(0);
    await expect(choice.locator('input[name="license"][value="CC-BY-SA"]')).toHaveCount(0);

    await expect(page.getByTestId("cc-by-hint")).toHaveCount(0);
    await choice.locator('input[value="CC-BY"]').check();
    await expect(choice).toContainText("Every use, worship and commercial, if they credit you");
    await expect(choice).toContainText("Not exclusivity");
    await expect(page.getByTestId("cc-by-hint")).toContainText("commercial use to everyone");
  });

  test("the library facet lists all six licenses and filters to the CC BY songs", async ({ page }) => {
    await page.goto("/songs?lang=English");
    const facet = page.getByTestId("license-facet");
    for (const id of ["PD", "WC", "CC-BY", "CC-BY-SA", "CC-BY-NC", "CC-BY-NC-SA"]) {
      await expect(facet.locator(`input[name="lic"][value="${id}"]`)).toHaveCount(1);
    }
    await facet.locator('input[name="lic"][value="CC-BY"]').check();
    const rows = page.locator(".t-row");
    await expect(rows.first()).toBeVisible();
    await expect(page.locator(".t-row", { hasText: CC_TITLE })).toHaveCount(1);
    const badges = rows.locator("[data-testid='license-badge']");
    await expect(badges.first()).toHaveAttribute("data-license", "CC-BY");
    expect(await badges.evaluateAll(els => els.every(e => e.getAttribute("data-license") === "CC-BY"))).toBe(true);
    await expect(page.locator("#active-chips")).toContainText("CC BY");
  });

  test("/license keeps the WorshipCommons brand page and adds one card per other license", async ({ page }) => {
    // client-side navigation: the Vite dev server answers a direct GET /license with the repo's LICENSE file
    await page.goto("/");
    await page.locator("nav").getByRole("link", { name: "The License" }).first().click();
    await expect(page.locator("h1")).toContainText("One page. Zero strings.");
    await expect(page.locator("#other-licenses")).toContainText("Other licenses in this library");
    for (const badge of ["pd", "cc-by", "cc-by-sa", "cc-by-nc", "cc-by-nc-sa"]) {
      await expect(page.getByTestId(`license-card-${badge}`)).toBeVisible();
    }
    const nc = page.getByTestId("license-card-cc-by-nc");
    await expect(nc).toContainText("Non-commercial");
    await expect(nc).toContainText("monetized");
    await expect(nc.locator("a[rel~='license']")).toHaveAttribute("href", "https://creativecommons.org/licenses/by-nc/4.0/legalcode");
    // no seventh license, no ND
    await expect(page.locator("#other-licenses")).not.toContainText("ND");
  });
});
