import { test, expect } from "@playwright/test";
import { WC_API } from "./helpers/api";

interface RankedSong { id: string; title: string; language: string; rank?: number; qualityScore?: number; }

// The moderation quality score is reviewer-only. The public payloads carry the opaque
// popularity/quality blend the API computes instead, and the library sorts on it.
test.describe("song rank", () => {
  test("public song payloads carry rank and never the quality score", async ({ request }) => {
    const songs: RankedSong[] = await (await request.get(`${WC_API}/songs`)).json();
    expect(songs.length).toBeGreaterThan(0);
    for (const s of songs) {
      expect(s, `${s.title} leaks qualityScore`).not.toHaveProperty("qualityScore");
      expect(typeof s.rank, `${s.title} has no rank`).toBe("number");
    }

    const detail = await (await request.get(`${WC_API}/songs/${songs[0].id}`)).json();
    expect(detail).not.toHaveProperty("qualityScore");
    expect(detail).not.toHaveProperty("qualityDetail");
    expect(typeof detail.rank).toBe("number");
  });

  test("the default library sort follows the API rank", async ({ page, request }) => {
    const songs: RankedSong[] = await (await request.get(`${WC_API}/songs`)).json();
    const topRank = Math.max(...songs.map(s => s.rank ?? 0));
    const top = songs.find(s => (s.rank ?? 0) === topRank)!;

    await page.goto("/songs");
    await page.getByLabel("Language", { exact: true }).selectOption("");
    await expect(page.locator("#sort")).toHaveValue("downloads");
    await expect(page.locator(".t-row").first()).toContainText(top.title);
  });
});
