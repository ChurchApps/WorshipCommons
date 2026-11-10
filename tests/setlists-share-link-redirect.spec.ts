import { test, expect, devices } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import * as vm from "vm";
import { fileURLToPath } from "url";
import { songIdByTitle } from "./helpers/api";

// Issue #1125: a shared service plan link opens on desktop but not on iPhones. On prod every extensionless path
// takes the apex function's 301 to its trailing-slash form, and CloudFront never sees the # fragment, so iOS link
// handlers and in-app browsers that don't re-attach it after the redirect open an empty share page.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const redirect = fs.readFileSync(path.join(__dirname, "../tools/cloudfront/apex-redirect.js"), "utf8");

/** The URL a client lands on after prod's viewer-request function, when the fragment is not carried across. */
function afterProdRedirect(link: string) {
  const url = new URL(link);
  const querystring: Record<string, { value: string }> = {};
  url.searchParams.forEach((value, key) => { querystring[key] = { value }; });
  const sandbox: { result?: any } = {};
  vm.createContext(sandbox);
  const event = JSON.stringify({ request: { headers: { host: { value: "worshipcommons.org" } }, uri: url.pathname, querystring } });
  vm.runInContext(`${redirect}\nthis.result = handler(${event});`, sandbox);
  const location: string = sandbox.result.statusCode === 301 ? sandbox.result.headers.location.value : "https://worshipcommons.org" + url.pathname + url.search + url.hash;
  const landed = new URL(location);
  return url.origin + landed.pathname + landed.search + landed.hash;
}

const { defaultBrowserType, ...iphone } = devices["iPhone 15"]; // eslint-disable-line @typescript-eslint/no-unused-vars

test("a shared service plan link still opens on an iPhone after the prod redirect", async ({ page, request, browser }) => {
  const grace = await songIdByTitle(request, "Amazing Grace");
  await page.goto("/setlists");
  const id = await page.evaluate(grace => {
    const now = new Date().toISOString();
    localStorage.setItem("wcSetlists", JSON.stringify([{ id: "spec1125", name: "iPhone share", createdAt: now, updatedAt: now, items: [{ songId: grace, key: "G", capo: 0 }] }]));
    return "spec1125";
  }, grace);
  await page.goto(`/setlists/${id}`);
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.resolve() }, configurable: true }));
  await page.getByTestId("share-link").click();
  const link = await page.getByTestId("share-url").inputValue();

  const phone = await browser.newContext({ ...iphone, storageState: { cookies: [], origins: [] } });
  const viewer = await phone.newPage();
  await viewer.goto(afterProdRedirect(link));
  await expect(viewer.getByTestId("setlist-title")).toHaveText("iPhone share");
  await phone.close();
});

test("share links already sent with the # form still open", async ({ page, request }) => {
  const grace = await songIdByTitle(request, "Amazing Grace");
  const payload = Buffer.from(JSON.stringify({ n: "Old share", i: [{ songId: grace, key: "G", capo: 0 }] })).toString("base64url");
  await page.goto(`/setlists/shared#${payload}`);
  await expect(page.getByTestId("setlist-title")).toHaveText("Old share");
});
