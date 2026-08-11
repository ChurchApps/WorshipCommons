import { test, expect } from "@playwright/test";
import { songIdByTitle } from "./helpers/api";

test("we-sing counter increments on the server and stays counted", async ({ page, request }) => {
  const id = await songIdByTitle(request, "Every Valley");
  await page.goto(`/songs/${id}`);
  await expect(page.getByTestId("cong-count")).toHaveText("0");

  await page.getByTestId("we-sing").click();
  await expect(page.getByTestId("cong-count")).toHaveText("1");
  await expect(page.getByTestId("we-sing")).toBeDisabled();
  await expect(page.getByTestId("we-sing")).toContainText("Counted");

  await page.reload();
  await expect(page.getByTestId("cong-count")).toHaveText("1");
  await expect(page.getByTestId("we-sing")).toBeDisabled();
});
