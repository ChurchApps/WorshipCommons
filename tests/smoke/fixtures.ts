import { test as base, expect, type Page } from "@playwright/test";

// Smoke specs run against a deployed site (staging or prod). They only navigate and read.
// Every test fails on an uncaught page error or a 5xx from our own hosts (the site, the Api, the content CDN).

const FIRST_PARTY = /(^|\.)(churchapps\.org|worshipcommons\.org)$|^localhost$|^127\.0\.0\.1$/;

type Watch = { pageErrors: string[]; apiFailures: string[] };

export const test = base.extend<{ watch: Watch }>({
  watch: [
    async ({ page }, use) => {
      const watch: Watch = { pageErrors: [], apiFailures: [] };
      page.on("pageerror", (e) => watch.pageErrors.push(e.message));
      page.on("response", (r) => {
        const type = r.request().resourceType();
        if (type !== "xhr" && type !== "fetch") return;
        const url = new URL(r.url());
        if (FIRST_PARTY.test(url.hostname) && r.status() >= 500) watch.apiFailures.push(`${r.status()} ${r.request().method()} ${url.hostname}${url.pathname}`);
      });
      await use(watch);
      expect(watch.pageErrors, "uncaught page errors").toEqual([]);
      expect(watch.apiFailures, "5xx responses from our hosts").toEqual([]);
    },
    { auto: true }
  ]
});

/** Navigate and wait for the GET that proves the page pulled real data from the API (prerendered HTML alone does not). */
export async function openAndLoad(page: Page, path: string, apiPath: RegExp) {
  const data = page.waitForResponse((r) => r.request().method() === "GET" && apiPath.test(new URL(r.url()).pathname), { timeout: 30000 });
  await page.goto(path);
  const res = await data;
  expect(res.status(), `${res.url()} status`).toBeLessThan(400);
  return res;
}

export { expect };
