import { chromium, type FullConfig } from "@playwright/test";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { verifyEnv } from "./setup/verify-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_STATE_PATH = path.join(__dirname, ".auth-state.json");

async function globalSetup(config: FullConfig) {
  await verifyEnv({ fullCheck: true });

  // fresh demo data every run — migrate then seed is the reset
  const apiDir = path.join(__dirname, "..", "..", "WorshipCommonsApi");
  execSync("yarn migrate:up", { cwd: apiDir, stdio: "inherit" });
  execSync("yarn seed", { cwd: apiDir, stdio: "inherit" });

  const baseURL = (config.projects[0].use.baseURL as string) || process.env.BASE_URL || "http://localhost:3104";

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(baseURL + "/login");
  await page.locator('input[type="email"]').waitFor({ state: "visible", timeout: 30000 });
  await page.fill('input[type="email"]', "demo@b1.church");
  await page.fill('input[type="password"]', "password");
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 20000 });

  await context.storageState({ path: STORAGE_STATE_PATH });
  await browser.close();
}

export default globalSetup;
export { STORAGE_STATE_PATH };
