import { test, expect } from "@playwright/test";
import { songIdByTitle, WC_API } from "./helpers/api";

test.describe("conservative public-domain and keep-CCLI copy", () => {
  test("Amazing Grace rights panel is US-centric and never says Free for churches", async ({ page, request }) => {
    await page.goto(`/songs/${await songIdByTitle(request, "Amazing Grace")}`);
    await expect(page.getByTestId("ccli-footnote")).toContainText("Keep CCLI for other songs you sing");
    await page.getByTestId("tab-about").click();
    const grant = page.getByTestId("license-grant");
    await expect(grant).toBeVisible();
    await expect(grant).toContainText(/United States|best-effort/);
    await expect(grant).toContainText("including commercial");
    await expect(grant).not.toContainText("Free for churches");
    await expect(page.getByTestId("nc-commercial-hint")).toHaveCount(0);
  });

  test("license FAQ leads with do not cancel CCLI", async ({ page }) => {
    await page.goto("/license/");
    const first = page.locator("#faq details").first();
    await expect(first.locator("summary")).toHaveText("Should we cancel our CCLI license?");
    await first.locator("summary").click();
    await expect(first).toContainText("Keep CCLI");
    await expect(first).toContainText("does not replace");
  });

  test("terms promise a 48-hour takedown aim", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.locator("main")).toContainText("48 hours");
  });

  test("a non-commercial grant warns that ads or a donation prompt may count as commercial", async ({ page, request }) => {
    const songs = await (await request.get(`${WC_API}/songs`)).json();
    const nc = songs.find((s: { license: string }) => s.license === "larry-holder")
      || songs.find((s: { license: string }) => /NC/i.test(s.license));
    test.skip(!nc, "no non-commercial song in the seed catalog");
    await page.goto(`/songs/${nc.id}`);
    await page.getByTestId("tab-about").click();
    await expect(page.getByTestId("nc-commercial-hint")).toBeVisible();
    await expect(page.getByTestId("nc-commercial-hint")).toContainText(/ads|donation prompt/);
  });
});
