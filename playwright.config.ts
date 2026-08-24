import { defineConfig, devices } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_STATE_PATH = path.join(__dirname, "tests", ".auth-state.json");

const baseURL = process.env.BASE_URL || "http://localhost:3104";

export default defineConfig({
  testDir: "./tests",
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Specs mutate the shared demo data (uploads, approvals, counters) — serialize.
  workers: 1,
  reporter: "list",
  timeout: 60 * 1000,
  expect: { timeout: 10 * 1000 },

  globalSetup: "./tests/global-setup.ts",

  use: {
    baseURL,
    storageState: STORAGE_STATE_PATH,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: 15 * 1000,
    navigationTimeout: 30 * 1000
  },

  webServer: [
    {
      command: `npm --prefix ${process.env.CORE_API_DIR || "../Api"} run dev`,
      url: "http://localhost:8084/health",
      reuseExistingServer: true,
      timeout: 60 * 1000,
      stdout: "pipe",
      stderr: "pipe"
    },
    {
      command: "yarn start",
      url: "http://localhost:3104",
      reuseExistingServer: true,
      timeout: 120 * 1000
    }
  ],

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], headless: true }
    }
  ]
});
