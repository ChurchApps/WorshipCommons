import { test, expect, Page } from "@playwright/test";
import { execSync } from "child_process";
import { songIdByTitle, WC_API } from "./helpers/api";

// bsdtar reads zips on Windows, macOS, and Linux; Git Bash's GNU tar does not, so name it by path on Windows
const TAR = process.platform === "win32" ? "C:/Windows/System32/tar.exe" : "tar";
const zipNames = (file: string) => execSync(`"${TAR}" -tf "${file}"`).toString().trim().split(/\r?\n/).sort();
const zipRead = (file: string, name: string) => execSync(`"${TAR}" -xOf "${file}" "${name}"`).toString();

// Setlists live in localStorage, and every test starts from the shared storage state, so the tests after the
// first seed their own set straight into the store instead of clicking through the song page again.
async function seed(page: Page, name: string, items: { songId: string; key: string; capo?: number; order?: string[] }[], extra: Record<string, unknown> = {}) {
  await page.goto("/setlists");
  return await page.evaluate(({ name, items, extra }) => {
    const now = new Date().toISOString();
    const setlist = { ...extra, id: "spec" + Math.random().toString(36).slice(2, 8), name, createdAt: now, updatedAt: now, items: items.map(i => ({ capo: 0, ...i })) };
    localStorage.setItem("wcSetlists", JSON.stringify([setlist]));
    return setlist.id;
  }, { name, items, extra });
}

const stubClipboard = (page: Page) => page.evaluate(() => {
  (window as any).__copied = "";
  Object.defineProperty(navigator, "clipboard", { value: { writeText: (t: string) => { (window as any).__copied = t; return Promise.resolve(); } }, configurable: true });
});

test.describe("setlists", () => {
  test("a song joins a new setlist from its page, and the set lists with a duration", async ({ page, request }) => {
    const grace = await songIdByTitle(request, "Amazing Grace");
    const vision = await songIdByTitle(request, "Be Thou My Vision");
    await page.goto(`/songs/${grace}`);
    await page.evaluate(() => localStorage.removeItem("wcSetlists"));
    await page.reload();

    await page.getByTestId("add-to-setlist").click();
    await page.getByTestId("setlist-new-name").fill("Sunday spec");
    await page.getByTestId("setlist-new-create").click();
    await expect(page.getByTestId("add-to-setlist")).toContainText("In Sunday spec");

    // a second song joins the existing set from the picker
    await page.goto(`/songs/${vision}`);
    await page.getByTestId("add-to-setlist").click();
    await page.getByTestId("setlist-option").filter({ hasText: "Sunday spec" }).click();
    await expect(page.getByTestId("add-to-setlist")).toContainText("In Sunday spec");

    await page.goto("/setlists");
    const row = page.getByTestId("setlist-row").filter({ hasText: "Sunday spec" });
    await expect(row).toBeVisible();
    await expect(row.getByTestId("setlist-meta")).toContainText("2 songs");
    await expect(row.getByTestId("setlist-duration")).toHaveText(/\d+ min/);

    await row.getByTestId("setlist-name").click();
    await expect(page.getByTestId("setlist-item")).toHaveCount(2);
    await expect(page.getByTestId("item-title").first()).toHaveText("Amazing Grace");
  });

  test("songs reorder, and the key and section picks survive a reload", async ({ page, request }) => {
    const grace = await songIdByTitle(request, "Amazing Grace");
    const vision = await songIdByTitle(request, "Be Thou My Vision");
    const id = await seed(page, "Order spec", [{ songId: grace, key: "G" }, { songId: vision, key: "D" }]);
    await page.goto(`/setlists/${id}`);
    await expect(page.getByTestId("item-title")).toHaveText(["Amazing Grace", "Be Thou My Vision"]);

    await page.getByTestId("setlist-item").first().getByTestId("move-down").click();
    await expect(page.getByTestId("item-title")).toHaveText(["Be Thou My Vision", "Amazing Grace"]);

    const grace2 = page.getByTestId("setlist-item").filter({ hasText: "Amazing Grace" });
    await grace2.getByTestId("item-key").selectOption("A");
    const picks = grace2.getByTestId("pick");
    const before = await picks.count();
    expect(before).toBeGreaterThan(1);
    await picks.first().getByTestId("pick-remove").click();
    await expect(picks).toHaveCount(before - 1);

    await page.reload();
    await expect(page.getByTestId("item-title")).toHaveText(["Be Thou My Vision", "Amazing Grace"]);
    const graceAfter = page.getByTestId("setlist-item").filter({ hasText: "Amazing Grace" });
    await expect(graceAfter.getByTestId("item-key")).toHaveValue("A");
    await expect(graceAfter.getByTestId("pick")).toHaveCount(before - 1);
  });

  test("the share link opens in a fresh browser with no storage and offers a copy", async ({ page, request, browser }) => {
    const grace = await songIdByTitle(request, "Amazing Grace");
    const vision = await songIdByTitle(request, "Be Thou My Vision");
    const id = await seed(page, "Share spec", [{ songId: grace, key: "G" }, { songId: vision, key: "D", capo: 2 }]);
    await page.goto(`/setlists/${id}`);
    await stubClipboard(page);
    await page.getByTestId("share-link").click();
    const link = await page.getByTestId("share-url").inputValue();
    expect(link).toMatch(/\/setlists\/shared#[A-Za-z0-9_-]+$/);

    const fresh = await browser.newContext({ storageState: { cookies: [], origins: [] } }); // the config's storageState would sign the viewer in
    const viewer = await fresh.newPage();
    await viewer.goto(link);
    await expect(viewer.getByTestId("setlist-title")).toHaveText("Share spec");
    await expect(viewer.getByTestId("item-title")).toHaveText(["Amazing Grace", "Be Thou My Vision"]);
    await expect(viewer.getByTestId("item-summary").nth(1)).toContainText("Capo 2");
    await expect(viewer.getByTestId("sign-in")).toBeVisible();

    await viewer.getByTestId("save-copy").click();
    await expect(viewer).toHaveURL(/\/setlists\/[a-z0-9]+$/);
    await expect(viewer.locator("input[data-testid=setlist-title]")).toHaveValue("Share spec"); // the editor swaps in once the saved copy is in localStorage
    await fresh.close();
  });

  test("stage mode shows one chart per screen and the arrow keys move through the set", async ({ page, request }) => {
    const grace = await songIdByTitle(request, "Amazing Grace");
    const vision = await songIdByTitle(request, "Be Thou My Vision");
    const id = await seed(page, "Stage spec", [{ songId: grace, key: "G" }, { songId: vision, key: "D" }]);
    await page.goto(`/setlists/${id}/stage`);
    await expect(page.getByTestId("stage-song")).toContainText("Amazing Grace");
    await expect(page.getByTestId("stage-song").locator(".chart-chord").filter({ hasText: /[A-G]/ }).first()).toBeVisible();
    await expect(page.getByTestId("stage-count")).toHaveText("1 / 2");
    await expect(page.getByTestId("wake-lock")).toBeVisible();

    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("stage-song")).toContainText("Be Thou My Vision");
    await expect(page.getByTestId("stage-count")).toHaveText("2 / 2");
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByTestId("stage-song")).toContainText("Amazing Grace");
  });

  test("the house-church pack zips slides, charts, and one LICENSE.txt; the ChordPro paste starts with {title:", async ({ page, request }) => {
    const grace = await songIdByTitle(request, "Amazing Grace");
    const vision = await songIdByTitle(request, "Be Thou My Vision");
    const id = await seed(page, "Pack spec", [{ songId: grace, key: "G" }, { songId: vision, key: "D" }]);
    await page.goto(`/setlists/${id}`);
    await expect(page.getByTestId("house-pack")).toBeEnabled();

    const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("house-pack").click()]);
    expect(download.suggestedFilename()).toBe("pack-spec-house-church.zip");
    const file = await download.path();
    const names = zipNames(file);
    expect(names).toContain("LICENSE.txt");
    expect(names.filter(n => n.endsWith("/slides.json"))).toHaveLength(2);
    expect(names.some(n => /^01-amazing-grace\/chart\.G\.cho$/.test(n))).toBe(true);
    expect(zipRead(file, "LICENSE.txt")).toContain("Public domain");
    expect(zipRead(file, "LICENSE.txt")).toContain("Be Thou My Vision");
    const slides = JSON.parse(zipRead(file, "01-amazing-grace/slides.json"));
    expect(slides.title).toBe("Amazing Grace");
    expect(slides.slides.length).toBeGreaterThan(0);
    expect(zipRead(file, "01-amazing-grace/chart.G.cho")).toContain("[G]");

    await stubClipboard(page);
    await page.getByTestId("copy-chordpro").click();
    await expect(page.getByTestId("copy-chordpro")).toContainText("Copied");
    const copied = await page.evaluate(() => (window as any).__copied as string);
    expect(copied.startsWith("{title: Amazing Grace}")).toBe(true);
    expect(copied).toContain("{title: Be Thou My Vision}");
    expect(copied).toContain("{key: D}");
  });

  test("a CC BY-SA song shows the notice and stays out of the pack until the set is marked share-alike", async ({ page, request }) => {
    const list = await (await request.get(`${WC_API}/songs`)).json();
    const sa = list.find((s: { license: string }) => s.license === "CC-BY-SA");
    if (!sa) throw new Error("Seed has no CC-BY-SA song");
    const grace = await songIdByTitle(request, "Amazing Grace");
    const id = await seed(page, "SA spec", [{ songId: grace, key: "G" }, { songId: sa.id, key: sa.songKey }]);
    await page.goto(`/setlists/${id}`);
    await expect(page.getByTestId("sa-notice")).toBeVisible();
    await expect(page.getByTestId("sa-notice")).toContainText(sa.title);
    await expect(page.getByTestId("house-pack")).toBeEnabled();

    const [excluded] = await Promise.all([page.waitForEvent("download"), page.getByTestId("house-pack").click()]);
    const without = zipNames(await excluded.path());
    expect(without.filter(n => n.endsWith("/slides.json"))).toHaveLength(1);
    expect(zipRead(await excluded.path(), "LICENSE.txt")).not.toContain(sa.title);

    await page.getByTestId("share-alike").check();
    await expect(page.getByTestId("share-alike")).toBeChecked();
    const [included] = await Promise.all([page.waitForEvent("download"), page.getByTestId("house-pack").click()]);
    const withSa = zipNames(await included.path());
    expect(withSa.filter(n => n.endsWith("/slides.json"))).toHaveLength(2);
    expect(zipRead(await included.path(), "LICENSE.txt")).toContain(sa.title);
  });
});
