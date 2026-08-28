import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const SHOTS = path.join(ROOT, ".notes", "screenshots");
const WAV = path.resolve(__dirname, "../tests/fixtures/tiny.wav");
const WC = "http://localhost:3104";
const ADMIN = "http://localhost:3101";
const INDEX = [];

fs.mkdirSync(SHOTS, { recursive: true });
for (const f of fs.readdirSync(SHOTS)) if (f.endsWith(".png")) fs.unlinkSync(path.join(SHOTS, f));

const stamp = Date.now();
const TITLE = `Every Valley Opened ${stamp}`;
const EMAIL = `wc.walkthrough.${stamp}@example.com`;
const PASSWORD = "Walkthrough1!";
const WRITER = "Jordan Hale";

const HIDE_CHAT = `
  div[aria-label="Open SuperBee chat"],
  div[aria-label="Open Bez chat"],
  div[aria-label="Open Doc chat"] { display: none !important; }
`;

let n = 0;
async function shot(page, slug, caption, { fullPage = true } = {}) {
  n += 1;
  const file = `${String(n).padStart(2, "0")}-${slug}.png`;
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SHOTS, file), fullPage });
  INDEX.push({ file, caption, url: page.url() });
  console.log("shot", file, "—", caption);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const wc = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const admin = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await admin.addInitScript((css) => {
    const inject = () => {
      if (document.head && !document.getElementById("__hide-chat__")) {
        const style = document.createElement("style");
        style.id = "__hide-chat__";
        style.textContent = css;
        document.head.appendChild(style);
      }
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", inject);
    else inject();
  }, HIDE_CHAT);

  const page = await wc.newPage();
  const adminPage = await admin.newPage();
  page.setDefaultTimeout(20000);
  adminPage.setDefaultTimeout(25000);

  // 1. Home, logged out
  await page.goto(WC + "/");
  await page.getByRole("heading").first().waitFor();
  await shot(page, "home-logged-out", "WorshipCommons home, not signed in");

  // 2. License
  await page.getByRole("link", { name: "The License" }).first().click();
  await page.getByRole("heading", { name: /One page/ }).waitFor();
  await shot(page, "license", "The WorshipCommons License page");

  // 3. Share a song → login gate
  await page.getByRole("link", { name: "Share a song" }).first().click();
  await page.getByRole("heading", { name: "Welcome back" }).waitFor();
  await shot(page, "login-gate", "Share a song redirects to sign in");

  // 4. Register
  await page.getByTestId("register-link").click();
  await page.getByRole("heading", { name: "Join the commons" }).waitFor();
  await shot(page, "register-empty", "Create-account form");
  await page.fill("#firstName", "Jordan");
  await page.fill("#lastName", "Hale");
  await page.fill("#email", EMAIL);
  await shot(page, "register-filled", "Create-account form filled");
  await page.getByRole("button", { name: "Create account" }).click();

  // Local API has no mail system — register returns authGuid and jumps to set password
  await page.getByRole("heading", { name: "Set your password" }).waitFor();
  await shot(page, "set-password", "Set password (local: email is not configured, so no 6-digit code)");
  await page.fill("#newPassword", PASSWORD);
  await page.fill("#verifyPassword", PASSWORD);
  await page.getByRole("button", { name: "Set password & sign in" }).click();

  // next=/upload
  await page.getByRole("heading", { name: "Give the church something to sing" }).waitFor();
  await shot(page, "upload-empty", "Upload form after signing in");

  // Fill the song
  await page.fill("#title", TITLE);
  await page.fill("#writers", WRITER);
  await page.fill("#year", "2026");
  await page.selectOption("#key", "G");
  await page.fill("#bpm", "92");
  await page.fill("#themes", "Hope, Mercy, Invitation");
  await page.fill("#scripture", "Isaiah 40:4");
  await page.fill("#lyrics", [
    "Verse 1",
    "[G]Every valley shall be [C]opened,",
    "[G]every mountain laid [D]low.",
    "[Em]Prepare the way, a [C]voice is crying:",
    "[G]the King of glory [D]comes. [G]",
    "",
    "Chorus",
    "[C]Lift your voice, [D]lift your [G]heart,",
    "[Em]the table is [C]ready, [D]come as you [G]are."
  ].join("\n"));
  await shot(page, "upload-song-filled", "Step 1: song metadata and ChordPro preview");

  await page.getByTestId("file-demo").setInputFiles(WAV);
  await page.locator(".dropzone", { hasText: "Attached ✓" }).waitFor();
  await page.check("#recording-owned");
  await shot(page, "upload-files", "Step 2: demo recording attached and ownership confirmed");

  await page.locator("label.choice", { hasText: "Free for worship" }).scrollIntoViewIfNeeded();
  const wcLicense = page.locator("input[name='license'][value='wc']");
  if (!(await wcLicense.isChecked())) await wcLicense.check();
  await shot(page, "upload-license", "Step 3: Free for worship (WorshipCommons License) selected");

  await page.selectOption("#pro", { index: 1 });
  await page.check("#certify");
  await shot(page, "upload-certify", "Step 4: certification checked, ready to submit");

  await page.getByRole("button", { name: "Add it to the commons" }).click();
  await page.getByTestId("upload-thanks").waitFor();
  await shot(page, "upload-thanks", "Thank-you: submission is in review");

  await page.goto(WC + "/my-songs");
  await page.getByTestId("my-song").filter({ hasText: TITLE }).waitFor();
  await shot(page, "my-songs-in-review", "My songs: the new song is In review");

  // 5. B1 Admin approval
  await adminPage.goto(ADMIN + "/");
  const emailInput = adminPage.locator('input[type="email"]');
  const navButton = adminPage.locator("#primaryNavButton");
  const winner = await Promise.race([
    navButton.waitFor({ state: "visible", timeout: 20000 }).then(() => "authenticated"),
    emailInput.waitFor({ state: "visible", timeout: 20000 }).then(() => "login")
  ]);
  if (winner === "login") {
    await shot(adminPage, "b1-login", "B1 Admin sign-in", { fullPage: false });
    await emailInput.fill("demo@b1.church");
    await adminPage.fill('input[type="password"]', "password");
    await adminPage.click('button[type="submit"]');
    const churchDialog = adminPage.locator('[role="dialog"]').filter({ hasText: "Select a Church" });
    await Promise.race([
      churchDialog.waitFor({ state: "visible", timeout: 15000 }).catch(() => {}),
      adminPage.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 }).catch(() => {})
    ]);
    if (await churchDialog.isVisible().catch(() => false)) {
      await shot(adminPage, "b1-select-church", "B1 Admin: pick a church after sign-in", { fullPage: false });
      const grace = adminPage.locator('[role="dialog"] h3:has-text("Grace Community Church")').first()
        .or(adminPage.locator('[role="dialog"] h3:has-text("Gracious Community Church")').first());
      await grace.click({ timeout: 10000 });
    }
  }
  await adminPage.locator("#primaryNavButton").waitFor({ state: "visible", timeout: 30000 });
  await shot(adminPage, "b1-dashboard", "B1 Admin dashboard after sign-in", { fullPage: false });

  await adminPage.locator("#primaryNavButton").click();
  await adminPage.locator('[data-testid="nav-item-settings"]').click();
  await adminPage.waitForURL(/\/settings/, { timeout: 15000 });
  const serverAdmin = adminPage.locator('[id="secondaryMenu"]').getByText("Server Admin", { exact: true }).first();
  await serverAdmin.waitFor({ state: "visible" });
  await serverAdmin.click();
  await adminPage.waitForURL(/\/admin/, { timeout: 15000 });
  await shot(adminPage, "b1-server-admin", "Server Admin landing — Commons is a side section", { fullPage: false });

  const commonsSection = adminPage.locator('[data-testid="settings-section-commons"]');
  await commonsSection.waitFor({ state: "visible" });
  await commonsSection.click();
  const songRow = adminPage.locator("#commonsQueueTable").locator("tr", { hasText: TITLE });
  await songRow.waitFor({ state: "visible", timeout: 20000 });
  await shot(adminPage, "b1-commons-queue", "Commons moderation queue with the new submission");

  await songRow.getByRole("button", { name: /Review/i }).click();
  const drawer = adminPage.getByTestId("commons-drawer");
  await drawer.waitFor({ state: "visible" });
  await drawer.getByRole("heading", { name: TITLE }).waitFor();
  await shot(adminPage, "b1-review-drawer", "Review drawer: payload, files, approve/reject");

  await drawer.getByTestId("commons-drawer-approve").click();
  await songRow.waitFor({ state: "hidden", timeout: 15000 });
  await shot(adminPage, "b1-queue-after-approve", "Queue after approve — the song is gone from pending");

  // 6. Live on the site
  await page.goto(WC + "/my-songs");
  const liveCard = page.getByTestId("my-song").filter({ hasText: TITLE });
  await liveCard.waitFor();
  await liveCard.getByTestId("my-song-status").filter({ hasText: "Live" }).waitFor({ timeout: 15000 });
  await shot(page, "my-songs-live", "My songs: status flipped to Live");

  await page.goto(WC + "/songs");
  await page.locator("#q").waitFor();
  await page.fill("#q", TITLE);
  const libraryRow = page.locator(".t-row", { hasText: TITLE });
  await libraryRow.waitFor({ state: "visible", timeout: 20000 });
  await shot(page, "library-hit", "Song library search finds the approved original");

  await libraryRow.getByRole("link").first().click();
  await page.getByRole("heading", { name: TITLE }).waitFor();
  await shot(page, "song-page", "Public song page: chart, metadata, demo audio");

  fs.writeFileSync(path.join(ROOT, ".notes", "walkthrough-index.json"), JSON.stringify({
    title: TITLE, email: EMAIL, writer: WRITER, shots: INDEX
  }, null, 2));

  await browser.close();
  console.log("DONE", TITLE);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
