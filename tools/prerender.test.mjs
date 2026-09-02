// node --test tools/prerender.test.mjs
// Covers the SEO surface of the prerender: hreflang alternates across a translated
// family, the MusicComposition JSON-LD, share-card meta, sitemap and llms.txt.
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { songPage, page, sitemapXml, llmsTxt, robotsTxt } from "./prerender.mjs";

// nothing here may touch a live API
globalThis.fetch = async (url) => { throw new Error(`unexpected network call: ${url}`); };

const SITE = "https://example.test";
const shell = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "index.html"), "utf8");

const SONGS = [
  {
    id: "rock-of-ages", title: "Rock of Ages", writer: "Augustus Toplady", year: 1763,
    themes: "Grace, Refuge", songKey: "G", bpm: 76, timeSignature: "4/4", language: "English",
    scripture: "Isaiah 26:4", license: "PD", authorId: "augustus-toplady",
    chordPro: "Verse 1\n[G]Rock of ages, cleft for [D]me", publishedAt: "2024-03-01T12:00:00.000Z"
  },
  {
    id: "roca-de-la-eternidad", title: "Roca de la Eternidad", writer: "T. M. Westrup", year: 1900,
    themes: "Gracia", songKey: "G", bpm: 76, timeSignature: "4/4", language: "Spanish",
    scripture: "Isaías 26:4", license: "PD", parentSongId: "rock-of-ages",
    relationLabel: "Spanish translation", chordPro: "Estrofa 1\n[G]Roca de la eternidad",
    createdAt: "2024-04-02T09:30:00.000Z"
  },
  {
    id: "steady-light", title: "Steady Light", writer: "Ada Vance", year: 2024,
    themes: "Hope", songKey: "D", bpm: 82, timeSignature: "3/4", language: "English",
    scripture: "", license: "WC", authorId: "ada-vance",
    fileUrls: { art: "https://cdn.example.test/steady-light/art.webp" },
    chordPro: "Chorus\n[D]Steady light", publishedAt: "2025-01-15T00:00:00.000Z"
  }
];

const jsonLdOf = (html) => JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);

test("hreflang alternates cover the translated family", () => {
  const original = songPage(shell, SONGS[0], SONGS, SITE);
  assert.match(original, /<link rel="alternate" hreflang="en" href="https:\/\/example\.test\/songs\/rock-of-ages\/">/);
  assert.match(original, /<link rel="alternate" hreflang="es" href="https:\/\/example\.test\/songs\/roca-de-la-eternidad\/">/);
  assert.match(original, /<link rel="alternate" hreflang="x-default" href="https:\/\/example\.test\/songs\/rock-of-ages\/">/);

  // the translation advertises the same family and the same x-default
  const translation = songPage(shell, SONGS[1], SONGS, SITE);
  assert.match(translation, /hreflang="en" href="https:\/\/example\.test\/songs\/rock-of-ages\/"/);
  assert.match(translation, /hreflang="x-default" href="https:\/\/example\.test\/songs\/rock-of-ages\/"/);
  assert.match(translation, /<link rel="canonical" href="https:\/\/example\.test\/songs\/roca-de-la-eternidad\/">/);

  // a song with no siblings gets no alternates at all
  assert.doesNotMatch(songPage(shell, SONGS[2], SONGS, SITE), /rel="alternate"/);
});

test("JSON-LD carries the translation graph and licensing", () => {
  const original = jsonLdOf(songPage(shell, SONGS[0], SONGS, SITE));
  assert.equal(original["@type"], "MusicComposition");
  assert.equal(original.url, `${SITE}/songs/rock-of-ages/`);
  assert.equal(original.musicalKey, "G");
  assert.equal(original.keywords, "Grace, Refuge");
  assert.equal(original.license, "https://creativecommons.org/publicdomain/mark/1.0/");
  assert.equal(original.translationOfWork, undefined);
  assert.deepEqual(original.workTranslation, [{
    "@type": "MusicComposition", name: "Roca de la Eternidad",
    url: `${SITE}/songs/roca-de-la-eternidad/`, inLanguage: "Spanish"
  }]);

  const translation = jsonLdOf(songPage(shell, SONGS[1], SONGS, SITE));
  assert.deepEqual(translation.translationOfWork, {
    "@type": "MusicComposition", name: "Rock of Ages",
    url: `${SITE}/songs/rock-of-ages/`, inLanguage: "English"
  });
  assert.equal(translation.workTranslation, undefined);

  // writer-shared songs point at the WorshipCommons license instead
  assert.equal(jsonLdOf(songPage(shell, SONGS[2], SONGS, SITE)).license, `${SITE}/license`);
});

test("share card meta uses the site base and the song image", () => {
  const html = songPage(shell, SONGS[2], SONGS, SITE);
  assert.match(html, /<meta property="og:image" content="https:\/\/example\.test\/og\/steady-light\.png">/);
  assert.match(html, /<meta property="og:image:width" content="1200">/);
  assert.match(html, /<meta property="og:image:height" content="630">/);
  assert.match(html, /<meta property="og:image:alt" content="Steady Light — Ada Vance">/);
  assert.match(html, /<meta name="twitter:image" content="https:\/\/example\.test\/og\/steady-light\.png">/);
  assert.match(html, /<meta name="twitter:title" content="Steady Light — free chords/);
  assert.match(html, /<meta name="twitter:description" content="Free chord chart/);

  // the hardcoded production og:image in index.html is rebased, never left behind
  const listing = page(shell, { title: "Song library", description: "All songs", canonical: `${SITE}/songs/`, body: "<main></main>", site: SITE });
  assert.match(listing, /<meta property="og:image" content="https:\/\/example\.test\/og\/site\.png">/);
  assert.doesNotMatch(listing, /worshipcommons\.org/);
});

test("sitemap lists every page with lastmod", () => {
  const xml = sitemapXml(SONGS, SITE);
  assert.match(xml, /<url><loc>https:\/\/example\.test\/songs\/rock-of-ages\/<\/loc><lastmod>2024-03-01<\/lastmod><\/url>/);
  assert.match(xml, /<loc>https:\/\/example\.test\/songs\/roca-de-la-eternidad\/<\/loc><lastmod>2024-04-02<\/lastmod>/); // falls back to createdAt
  assert.match(xml, /<loc>https:\/\/example\.test\/terms<\/loc>/);
  assert.match(xml, /<loc>https:\/\/example\.test\/new<\/loc>/);
  assert.match(xml, /<loc>https:\/\/example\.test\/call-for-songs\/<\/loc>/);
  assert.match(xml, /<loc>https:\/\/example\.test\/writers\/augustus-toplady<\/loc>/);
  assert.match(xml, /<loc>https:\/\/example\.test\/writers\/ada-vance<\/loc>/);
  assert.equal(xml.match(/<loc>/g).length, 7 + SONGS.length + 2);
});

test("llms.txt and robots.txt invite the AI crawlers", () => {
  const llms = llmsTxt(SONGS, SITE);
  assert.match(llms, /^# WorshipCommons/);
  assert.match(llms, /Full terms: https:\/\/example\.test\/license/);
  assert.match(llms, /- \[Song library\]\(https:\/\/example\.test\/songs\/\)/);
  assert.match(llms, /\n## Songs\n/);
  assert.match(llms, /- \[Rock of Ages by Augustus Toplady\]\(https:\/\/example\.test\/songs\/rock-of-ages\/\)/);
  assert.match(llms, /- \[Steady Light by Ada Vance\]\(https:\/\/example\.test\/songs\/steady-light\/\)/);
  assert.doesNotMatch(llms, /feed\.xml/);
  assert.match(llmsTxt(SONGS, SITE, true), /- \[Feed\]\(https:\/\/example\.test\/feed\.xml\)/);

  const robots = robotsTxt(SITE);
  for (const agent of ["*", "GPTBot", "ClaudeBot", "CCBot", "Google-Extended", "PerplexityBot"]) {
    assert.ok(robots.includes(`User-agent: ${agent}\nAllow: /`), `robots.txt is missing ${agent}`);
  }
  assert.match(robots, /Sitemap: https:\/\/example\.test\/sitemap\.xml/);
});
