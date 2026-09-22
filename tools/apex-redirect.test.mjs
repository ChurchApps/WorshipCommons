// node --test tools/apex-redirect.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as vm from "vm";
import { fileURLToPath } from "url";

const code = fs.readFileSync(fileURLToPath(new URL("./cloudfront/apex-redirect.js", import.meta.url)), "utf8");

function run(host, uri, querystring = {}) {
  const sandbox = {};
  vm.createContext(sandbox);
  const event = JSON.stringify({ request: { headers: { host: { value: host } }, uri, querystring } });
  vm.runInContext(`${code}\nthis.result = handler(${event});`, sandbox);
  return sandbox.result;
}

test("www and extensionless paths 301 to the apex trailing-slash URL", () => {
  assert.equal(run("www.worshipcommons.org", "/").headers.location.value, "https://worshipcommons.org/");
  assert.equal(run("WWW.WorshipCommons.org", "/songs").statusCode, 301);
  assert.equal(run("www.worshipcommons.org", "/songs").headers.location.value, "https://worshipcommons.org/songs/");
  assert.equal(run("worshipcommons.org", "/mission").headers.location.value, "https://worshipcommons.org/mission/");
  assert.equal(run("worshipcommons.org", "/index.html").headers.location.value, "https://worshipcommons.org/");
  const searched = run("www.worshipcommons.org", "/songs", { q: { value: "o come" } });
  assert.equal(searched.headers.location.value, "https://worshipcommons.org/songs/?q=o%20come");
});

test("files and already-canonical paths pass through", () => {
  for (const uri of [
    "/", "/songs/", "/favicon.svg", "/feed.xml", "/robots.txt", "/sitemap.xml", "/assets/index-abc.js", "/og/site.png"
  ]) {
    const result = run("worshipcommons.org", uri);
    assert.equal(result.statusCode, undefined, uri);
    assert.equal(result.uri, uri);
  }
});
