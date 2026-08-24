import { test, expect } from "@playwright/test";
import { createPendingSong, rejectSubmission, submissionDetail, userJwt } from "./helpers/api";

test.describe.serial("submission preview", () => {
  const TITLE = "Preview Spec Song";
  let submissionId = "";
  let token = "";

  test("the token-gated preview renders the proposed chart with no site chrome", async ({ page, request }) => {
    const jwt = await userJwt(request);
    submissionId = (await createPendingSong(request, jwt, TITLE)).submissionId;
    const detail = await submissionDetail(request, submissionId);
    token = new URL(detail.previewUrl).searchParams.get("token") as string;
    expect(token).toBeTruthy();

    await page.goto(`/preview/submission/${submissionId}?token=${encodeURIComponent(token)}`);
    await expect(page.getByRole("heading", { name: TITLE })).toBeVisible();
    const chart = page.getByTestId("preview-chart");
    await expect(chart.locator(".stanza-label")).toHaveText("Verse 1");
    await expect(chart.locator(".seg .c").first()).toHaveText("C");
    await expect(page.locator(".site-header")).toHaveCount(0);
  });

  test("a bad token shows nothing", async ({ page }) => {
    await page.goto(`/preview/submission/${submissionId}?token=1.bogus`);
    await expect(page.getByText("Preview unavailable.")).toBeVisible();
  });

  test("cleanup: reject the preview submission", async ({ request }) => {
    await rejectSubmission(request, submissionId);
  });
});
