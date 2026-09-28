import { test, expect } from "@playwright/test";

test("listen plays recent writer songs, skips, and links to details", async ({ page }) => {
  await page.goto("/listen");
  const title = page.getByTestId("listen-title");
  await expect(title).toBeVisible();
  await expect(page.getByTestId("listen-audio")).toHaveAttribute("src", /\.(mp3|wav|m4a|ogg|flac)/i);
  const first = await title.textContent();
  await page.getByTestId("listen-skip").click();
  await expect(title).not.toHaveText(first!);
  // a missing recording auto-skips; wait until this track has really loaded
  await expect.poll(() => page.getByTestId("listen-audio").evaluate((a: HTMLAudioElement) => a.readyState)).toBeGreaterThan(0);
  // global setup signs in the demo user
  const save = page.getByTestId("listen-save");
  await save.click();
  await expect(save).toHaveText("✓ Saved");
  await save.click();
  await expect(save).toHaveText("+ Save song");
  await page.getByTestId("listen-details").click();
  await expect(page).toHaveURL(/\/songs\/[^/]+$/);
});
