import { test, expect } from "@playwright/test";
import { songIdByTitle, WC_API } from "./helpers/api";

test("downloading a file increments the count once per client", async ({ page, request }) => {
  const id = await songIdByTitle(request, "Silent Night");
  await page.goto(`/songs/${id}`);

  const countEl = page.getByTestId("download-count");
  const before = Number((await countEl.textContent())?.replace(/\D/g, ""));

  const midiLink = page.getByRole("link", { name: "Melody (MIDI)" });
  const isDownloadPost = (r: import("@playwright/test").Response) => r.url() === `${WC_API}/assets/${id}/download` && r.request().method() === "POST";

  await Promise.all([
    page.waitForResponse(isDownloadPost),
    page.waitForEvent("download"),
    midiLink.click()
  ]);
  await expect(countEl).toHaveText(String(before + 1));

  // persists across reload — the server, not local state, holds the count
  await page.reload();
  await expect(countEl).toHaveText(String(before + 1));

  // a repeat download from the same client is IP-deduped, not double-counted
  await Promise.all([
    page.waitForResponse(isDownloadPost),
    page.waitForEvent("download"),
    midiLink.click()
  ]);
  await expect(countEl).toHaveText(String(before + 1));
});
