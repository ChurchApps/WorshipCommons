import { test, expect } from "@playwright/test";
import { songIdByTitle } from "./helpers/api";

let AMAZING_GRACE = "";

test.beforeAll(async ({ request }) => {
  AMAZING_GRACE = `/songs/${await songIdByTitle(request, "Amazing Grace")}`;
});

test.describe("print chart chords toggle", () => {
  test("the song page chords toggle carries over to the print link", async ({ page }) => {
    await page.goto(AMAZING_GRACE);
    await expect(page.locator(".song-title")).toBeVisible();

    // chords on by default — the print link carries no chords param
    await expect(page.getByRole("link", { name: "Chord chart (print)" })).toHaveAttribute("href", /\/print\?key=[^"]*$/);
    await expect(page.getByRole("link", { name: "Chord chart (print)" })).not.toHaveAttribute("href", /chords=0/);

    await page.locator("#chords-toggle").uncheck();
    await page.getByRole("link", { name: "Chord chart (print)" }).click();

    await expect(page).toHaveURL(/chords=0/);
    await expect(page.getByRole("heading", { name: "Amazing Grace" })).toBeVisible();
    await expect(page.getByText("sweet the").first()).toBeVisible();
    await expect(page.locator(".print-chord")).toHaveCount(0);
    await expect(page.getByTestId("print-chords")).not.toBeChecked();
  });

  test("the print page checkbox turns chords back on and off", async ({ page }) => {
    await page.goto(AMAZING_GRACE + "/print?chords=0");
    await expect(page.getByRole("heading", { name: "Amazing Grace" })).toBeVisible();
    await expect(page.locator(".print-chord")).toHaveCount(0);

    await page.getByTestId("print-chords").check();
    await expect(page.locator(".print-chord").first()).toHaveText("G");

    await page.getByTestId("print-chords").uncheck();
    await expect(page.locator(".print-chord")).toHaveCount(0);
    await expect(page.getByText("sweet the").first()).toBeVisible();
  });

  test("chords render by default on the print page", async ({ page }) => {
    await page.goto(AMAZING_GRACE + "/print");
    await expect(page.getByTestId("print-chords")).toBeChecked();
    await expect(page.locator(".print-chord").first()).toHaveText("G");
  });
});
