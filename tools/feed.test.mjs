// node --test tools/feed.test.mjs
// Covers the Atom changelog the prerender writes to build/feed.xml.
import test from "node:test";
import assert from "node:assert/strict";
import { feedXml } from "./prerender.mjs";

// nothing here may touch a live API
globalThis.fetch = async (url) => { throw new Error(`unexpected network call: ${url}`); };

const SITE = "https://example.test";

const SONGS = [
  { id: "OlderHymn01", title: "Older Hymn", writer: "Augustus Toplady", license: "PD", songKey: "G", publishedAt: "2026-05-01T12:00:00.000Z" },
  { id: "NewestSong1", title: "Newest & Best", writer: "Ada Vance", license: "WC", songKey: "D", publishedAt: "2026-08-14T00:00:00.000Z" },
  { id: "CreatedOnl1", title: "Created Only", writer: "Ben Ash", license: "WC", songKey: "A", createdAt: "2026-07-02T09:30:00.000Z" },
  { id: "Undated0001", title: "Undated", writer: "Nobody", license: "PD", songKey: "C" }
];

const entryIds = (xml) => [...xml.matchAll(/<id>https:\/\/example\.test\/songs\/([^/]+)\//g)].map(m => m[1].slice(-11));

test("feed lists dated songs newest first and skips undated ones", () => {
  const xml = feedXml(SONGS, SITE);
  assert.deepEqual(entryIds(xml), ["NewestSong1", "CreatedOnl1", "OlderHymn01"]);
  assert.match(xml, /<updated>2026-08-14T00:00:00\.000Z<\/updated>[\s\S]*<entry>/);
  assert.match(xml, /<link rel="self" href="https:\/\/example\.test\/feed\.xml"\/>/);
  assert.match(xml, /<link href="https:\/\/example\.test\/new\/"\/>/);
});

test("entries carry absolute song links, authors, and escaped titles", () => {
  const xml = feedXml(SONGS, SITE);
  assert.match(xml, /<link href="https:\/\/example\.test\/songs\/newest-best-NewestSong1\/"\/>/);
  assert.match(xml, /<title>Newest &amp; Best<\/title>/);
  assert.match(xml, /<author><name>Ada Vance<\/name><\/author>/);
  assert.match(xml, /Older Hymn by Augustus Toplady — public domain, key of G\./);
  assert.match(xml, /Newest &amp; Best by Ada Vance — free for worship, key of D\./);
});

test("the window is capped and an empty catalog still emits a valid feed", () => {
  const many = Array.from({ length: 60 }, (_, i) => ({
    id: `s${String(i).padStart(10, "0")}`, title: `Song ${i}`, writer: "W", license: "WC", songKey: "C",
    publishedAt: new Date(Date.UTC(2026, 0, 1) + i * 86400000).toISOString()
  }));
  assert.equal(entryIds(feedXml(many, SITE)).length, 50);
  assert.equal(entryIds(feedXml(many, SITE))[0], "s0000000059");

  const empty = feedXml([], SITE);
  assert.doesNotMatch(empty, /<entry>/);
  assert.match(empty, /<\/feed>\n$/);
});
