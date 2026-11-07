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

test("paths that are no route of the site get a real 404 page", () => {
  for (const uri of ["/nonexistent-page-xyz", "/nonexistent-page-xyz/", "/wp-admin/setup.php", "/llms-full/"]) {
    const result = run("worshipcommons.org", uri);
    assert.equal(result.statusCode, 404, uri);
    assert.match(result.body.data, /Page not found/);
    assert.match(result.body.data, /noindex/);
  }
  // even on www, answer 404 instead of redirecting to one
  assert.equal(run("www.worshipcommons.org", "/nope").statusCode, 404);
});

test("every route of the site still passes or redirects", () => {
  for (const uri of [
    "/hymns/", "/no-ccli/", "/songs/christmas/", "/writers/fanny-crosby-abcdefghijk/", "/login/", "/setlists/shared/", "/preview/submission/x/", "/spa.html", "/llms.txt", "/soundfonts/x.js", "/mock/x.jpg"
  ]) {
    const result = run("worshipcommons.org", uri);
    assert.equal(result.statusCode, undefined, uri);
  }
  assert.equal(run("worshipcommons.org", "/hymns").headers.location.value, "https://worshipcommons.org/hymns/");
  assert.equal(run("worshipcommons.org", "/songs/abc/print").headers.location.value, "https://worshipcommons.org/songs/abc/print/");
});
