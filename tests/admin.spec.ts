import { test, expect } from "@playwright/test";
import { userJwt, createPendingSong, createReport } from "./helpers/api";

test.describe("admin queue", () => {
  test("reject removes a pending song from the queue and the library", async ({ page, request }) => {
    const jwt = await userJwt(request);
    await createPendingSong(request, jwt, "Spec Reject Me");

    await page.goto("/admin");
    const card = page.getByTestId("pending-song").filter({ hasText: "Spec Reject Me" });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Reject" }).click();
    await expect(card).toHaveCount(0);

    await page.goto("/songs");
    await page.fill("#q", "spec reject me");
    await expect(page.getByText("Nothing matches yet")).toBeVisible();
  });

  test("resolve clears an open report", async ({ page, request }) => {
    await createReport(request, "Spec Report Song");

    await page.goto("/admin");
    const card = page.getByTestId("open-report").filter({ hasText: "Spec Report Song" });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Mark resolved" }).click();
    await expect(card).toHaveCount(0);
  });
});
