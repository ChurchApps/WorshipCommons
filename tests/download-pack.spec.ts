import { test, expect } from "@playwright/test";
import { execSync } from "child_process";
import { songWithoutSheetPdf, WC_API } from "./helpers/api";

// bsdtar reads zips on Windows, macOS, and Linux; Git Bash's GNU tar does not, so name it by path on Windows
const TAR = process.platform === "win32" ? "C:/Windows/System32/tar.exe" : "tar";

test("the composition pack is a prebuilt zip with the chart, melody MIDI, and the license", async ({ page, request }) => {
  const { id } = await songWithoutSheetPdf(request);
  await page.goto(`/songs/${id}`);
  const countEl = page.getByTestId("download-count");
  const before = Number((await countEl.textContent())?.replace(/\D/g, ""));

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.waitForResponse(r => r.url() === `${WC_API}/assets/${id}/download` && r.request().method() === "POST"),
    page.getByRole("link", { name: "Composition pack" }).click()
  ]);
  expect(download.suggestedFilename()).toBe("composition.zip");
  const file = await download.path();

  // root-level entries, no folder: what tools/generate.mjs packs from output/composition + sources
  const names = execSync(`"${TAR}" -tf "${file}"`).toString().trim().split(/\r?\n/).sort();
  expect(names).toEqual(expect.arrayContaining(["LICENSE.txt", "attribution.txt", "chart.chordpro", "score.mid"]));
  expect(names).not.toContain("slides.json");
  expect(execSync(`"${TAR}" -xOf "${file}" chart.chordpro`).toString()).toMatch(/\[[A-G][#b]?/);
  expect(execSync(`"${TAR}" -xOf "${file}" LICENSE.txt`).toString()).toContain("Public domain");
  // MIDI header, not an error page
  expect(execSync(`"${TAR}" -xOf "${file}" score.mid`).subarray(0, 4).toString()).toBe("MThd");

  await expect(countEl).toHaveText(String(before + 1));
});
