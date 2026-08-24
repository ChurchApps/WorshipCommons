import { test, expect } from "@playwright/test";

test.describe("auth", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("bad password shows an error", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", "demo@b1.church");
    await page.fill("#password", "wrong-password");
    await page.click('button[type="submit"]');
    await expect(page.getByTestId("login-error")).toBeVisible();
  });

  test("upload requires sign-in and login flows back to it", async ({ page }) => {
    await page.goto("/upload");
    await expect(page).toHaveURL(/\/login\?next=%2Fupload/);

    await page.fill("#email", "demo@b1.church");
    await page.fill("#password", "password");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/upload$/);
    await expect(page.getByRole("heading", { name: "Give the church something to sing" })).toBeVisible();
    await expect(page.getByTestId("sign-out")).toContainText("Demo");
  });

  test("admin routes reject anonymous API calls", async ({ request }) => {
    const resp = await request.get("http://localhost:8084/commons/admin/submissions");
    expect(resp.status()).toBe(401);
  });
});
