import { test, expect } from "@playwright/test";
import { approveSubmission, createPendingSong, songIdByTitle, userJwt } from "./helpers/api";

const TITLE = "Writer Profile Spec Song";
const BIO = "I write hymns for a small congregation in Kansas.";
const LINK = "https://specwriter.example/songs";

test.describe.serial("writer profile", () => {
  test("publishing a solo-credited song claims a writer page the submitter can edit", async ({ page, request }) => {
    const jwt = await userJwt(request);
    const draft = await createPendingSong(request, jwt, TITLE);
    await approveSubmission(request, draft.submissionId);

    await page.goto("/my-songs");
    await page.getByTestId("writer-profile-link").click();
    await expect(page).toHaveURL(/\/profile$/);

    await page.getByTestId("profile-bio").fill(BIO);
    await page.getByTestId("profile-link-label").first().fill("My site");
    await page.getByTestId("profile-link-url").first().fill(LINK);
    await page.getByTestId("profile-save").click();
    await expect(page.getByTestId("profile-status")).toHaveText("Saved.");

    await page.getByTestId("view-writer-page").click();
    await expect(page.getByTestId("writer-bio")).toHaveText(BIO);
    await expect(page.getByTestId("writer-links").getByRole("link", { name: "My site" })).toHaveAttribute("href", LINK);
    await expect(page.getByTestId("writer-song").filter({ hasText: TITLE })).toBeVisible();
  });

  test("the saved bio survives a reload and shows on the song page", async ({ page, request }) => {
    await page.goto("/profile");
    await expect(page.getByTestId("profile-bio")).toHaveValue(BIO);

    const id = await songIdByTitle(request, TITLE);
    await page.goto(`/songs/${id}`);
    await expect(page.getByTestId("about-the-writer")).toBeVisible();
    await expect(page.getByTestId("song-writer-bio")).toHaveText(BIO);
  });

  test("a link that is not http or https is refused", async ({ page }) => {
    await page.goto("/profile");
    await page.getByTestId("profile-link-url").first().fill("ftp://specwriter.example/files");
    await page.getByTestId("profile-save").click();
    await expect(page.getByTestId("profile-error")).toContainText("ftp://specwriter.example/files");
  });
});
