import { test, expect } from "@playwright/test";

// #1220: a co-writer (or a writer already in the library) has no linked writer page,
// and the empty Writer profile must tell them how to get it linked.
test("the empty writer profile tells co-writers to ask support to link their page", async ({ page }) => {
  await page.route(/\/authors\/mine$/, route => route.request().method() === "GET" ? route.fulfill({ json: {} }) : route.continue());
  await page.goto("/profile");
  const empty = page.getByTestId("no-writer-page");
  await expect(empty).toBeVisible();
  await expect(empty.getByRole("link", { name: "support@churchapps.org" })).toHaveAttribute("href", "mailto:support@churchapps.org");
});
