import { test, expect } from "@playwright/test";
import { execSync } from "child_process";
import { songIdByTitle, WC_API } from "./helpers/api";

// bsdtar reads zips on Windows, macOS, and Linux; Git Bash's GNU tar does not, so name it by path on Windows
const TAR = process.platform === "win32" ? "C:/Windows/System32/tar.exe" : "tar";

test("download pack bundles chart, lyrics, melody, art, and the license as one zip", async ({ page, request }) => {
  const id = await songIdByTitle(request, "Amazing Grace");
  await page.goto(`/songs/${id}`);
  const countEl = page.getByTestId("download-count");
  const before = Number((await countEl.textContent())?.replace(/\D/g, ""));

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.waitForResponse(r => r.url() === `${WC_API}/assets/${id}/download` && r.request().method() === "POST"),
    page.getByTestId("download-pack").click()
  ]);
  expect(download.suggestedFilename()).toBe("amazing-grace.zip");
  const file = await download.path();

  const names = execSync(`"${TAR}" -tf "${file}"`).toString().trim().split(/\r?\n/).sort();
  expect(names).toEqual(["LICENSE.txt", "amazing-grace-art.webp", "amazing-grace-lyrics.txt", "amazing-grace.cho", "amazing-grace.mid"]);
  expect(execSync(`"${TAR}" -xOf "${file}" amazing-grace.cho`).toString()).toContain("[G]");
  expect(execSync(`"${TAR}" -xOf "${file}" amazing-grace-lyrics.txt`).toString()).toContain("Amazing grace");
  expect(execSync(`"${TAR}" -xOf "${file}" LICENSE.txt`).toString()).toContain("Public domain");
  // MIDI header and a real webp, not error pages
  expect(execSync(`"${TAR}" -xOf "${file}" amazing-grace.mid`).subarray(0, 4).toString()).toBe("MThd");
  expect(execSync(`"${TAR}" -xOf "${file}" amazing-grace-art.webp`).subarray(8, 12).toString()).toBe("WEBP");

  await expect(countEl).toHaveText(String(before + 1));
});
