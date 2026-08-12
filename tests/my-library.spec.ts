import { test, expect } from "@playwright/test";
import { songIdByTitle } from "./helpers/api";

test.describe.serial("saved library", () => {
  test("signed-out save prompts for login", async ({ page, request }) => {
    const id = await songIdByTitle(request, "Be Thou My Vision");
    await page.context().clearCookies();
    await page.goto(`/songs/${id}`);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.getByTestId("library-toggle").click();
    await expect(page).toHaveURL(/\/login\?next=/);
  });

  test("saving persists to the account and counts a church", async ({ page, request }) => {
    const id = await songIdByTitle(request, "Be Thou My Vision");
    await page.goto(`/songs/${id}`);
    const before = Number((await page.getByTestId("cong-count").textContent()).replace(/\D/g, ""));

    await page.getByTestId("library-toggle").click();
    await expect(page.getByTestId("library-toggle")).toContainText("In your library");
    await expect(page.getByTestId("cong-count")).toHaveText(String(before + 1));

    // survives a reload with localStorage wiped — it lives on the server now
    await page.evaluate(() => localStorage.removeItem("wcLibrary"));
    await page.reload();
    await expect(page.getByTestId("library-toggle")).toContainText("In your library");

    await page.goto("/library");
    const card = page.getByTestId("library-song").filter({ hasText: "Be Thou My Vision" });
    await expect(card).toBeVisible();

    await card.getByTestId("library-remove").click();
    await page.reload();
    await expect(card).toHaveCount(0);
  });
});
