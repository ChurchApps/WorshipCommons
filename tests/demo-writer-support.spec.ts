import { test, expect } from "@playwright/test";
import { approveSubmission, createPendingSong, songIdByTitle, userJwt, WC_API } from "./helpers/api";

const TITLE = "Writer Support Spec Song";
const BANDCAMP = "https://specwriter.example/music";
const STORE = "https://specwriter.example/store";

test.describe.serial("writer support links", () => {
  test("a writer can list several support links and churches see a Support button", async ({ page, request }) => {
    const jwt = await userJwt(request);
    const mine = await (await request.get(`${WC_API}/authors/mine`, { headers: { Authorization: `Bearer ${jwt}` } })).json().catch(() => null);
    const draft = await createPendingSong(request, jwt, TITLE, mine?.name ? { writer: mine.name } : {});
    await approveSubmission(request, draft.submissionId);

    await page.goto("/profile");
    await expect(page.getByTestId("profile-support-url").first()).toBeVisible();
    await page.getByTestId("profile-support-label").first().fill("Bandcamp");
    await page.getByTestId("profile-support-url").first().fill(BANDCAMP);
    await page.getByTestId("profile-support-add").click();
    await page.getByTestId("profile-support-label").nth(1).fill("Store");
    await page.getByTestId("profile-support-url").nth(1).fill(STORE);
    await page.getByTestId("profile-save").click();
    await expect(page.getByTestId("profile-status")).toHaveText("Saved.");

    await page.getByTestId("view-writer-page").click();
    const support = page.getByTestId("support-writer");
    await expect(support).toBeVisible();
    await expect(support).toHaveText("Songwriter’s pages");
    await support.click();
    const menu = page.getByTestId("support-menu");
    await expect(menu).toBeVisible();
    await expect(menu.getByTestId("support-option")).toHaveCount(2);
    await expect(menu.getByRole("menuitem", { name: "Bandcamp" })).toHaveAttribute("href", BANDCAMP);
    await expect(menu.getByRole("menuitem", { name: "Store" })).toHaveAttribute("href", STORE);

    const id = await songIdByTitle(request, TITLE);
    await page.goto(`/songs/${id}`);
    const songSupport = page.getByTestId("support-writer");
    await expect(songSupport).toBeVisible();
    await songSupport.click();
    await expect(page.getByTestId("support-menu").getByRole("menuitem", { name: "Bandcamp" })).toHaveAttribute("href", BANDCAMP);
  });

  test("a public-domain hymn never shows the Support button", async ({ page, request }) => {
    await page.goto(`/songs/${await songIdByTitle(request, "Amazing Grace")}`);
    await expect(page.getByTestId("license-badge")).toHaveAttribute("data-license", "PD");
    await expect(page.getByTestId("support-writer")).toHaveCount(0);
  });

  test("a single support link is a direct button, not a menu", async ({ page }) => {
    await page.goto("/profile");
    await page.getByTestId("profile-support-remove").nth(1).click();
    await page.getByTestId("profile-save").click();
    await expect(page.getByTestId("profile-status")).toHaveText("Saved.");

    await page.getByTestId("view-writer-page").click();
    const support = page.getByTestId("support-writer");
    await expect(support).toHaveAttribute("href", BANDCAMP);
    await expect(page.getByTestId("support-menu")).toHaveCount(0);
  });

  test("the license FAQ says singing is a gift, not a royalty", async ({ page }) => {
    await page.goto("/license/");
    await page.getByText("Does this mean writers work for free?").click();
    await expect(page.getByText("We do not collect a royalty for singing.")).toBeVisible();
    await expect(page.getByText("Congregational success is not a paycheck.")).toBeVisible();
    await expect(page.getByText("Keep CCLI for the catalog that does.")).toBeVisible();
  });
});
