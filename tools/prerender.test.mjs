// node --test tools/prerender.test.mjs
// Covers the SEO surface of the prerender: hreflang alternates across a translated
// family, the MusicComposition JSON-LD, share-card meta, sitemap and llms.txt.
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { songPage, songBody, page, sitemapXml, llmsTxt, robotsTxt, staticPages, writeStaticPages, homePage, writerPage, writeWriterPages, writeGatedPages, langIso, personsOf, writeLegacySongRedirects, redirectPage, spaFallbackPage, writeCollectionPages, collectionPage, creditJsonLd } from "./prerender.mjs";
import { personId, personPath } from "../src/credits.mjs";
import { COLLECTIONS, collectionBySlug } from "../src/collections.mjs";
import { idOf, songPath, writerPath } from "../src/slug.mjs";
import { indexablePath, canonicalPath } from "../src/crawl.mjs";
import * as os from "os";

// nothing here may touch a live API
globalThis.fetch = async (url) => { throw new Error(`unexpected network call: ${url}`); };

const SITE = "https://example.test";
const shell = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "index.html"), "utf8");

const SONGS = [
  {
    id: "RockOfAges1",
    title: "Rock of Ages",
    writer: "Augustus Toplady",
    year: 1763,
    themes: "Grace, Refuge",
    songKey: "G",
    bpm: 76,
    timeSignature: "4/4",
    language: "English",
    scripture: "Isaiah 26:4",
    license: "PD",
    authorId: "toplady0001",
    chordPro: "Verse 1\n[G]Rock of ages, cleft for [D]me",
    publishedAt: "2024-03-01T12:00:00.000Z"
  },
  {
    id: "RocaEtern01",
    title: "Roca de la Eternidad",
    writer: "T. M. Westrup",
    year: 1900,
    themes: "Gracia",
    songKey: "G",
    bpm: 76,
    timeSignature: "4/4",
    language: "Spanish",
    scripture: "Isaías 26:4",
    license: "PD",
    parentSongId: "RockOfAges1",
    relationLabel: "Spanish translation",
    chordPro: "Estrofa 1\n[G]Roca de la eternidad",
    createdAt: "2024-04-02T09:30:00.000Z"
  },
  {
    id: "SteadyLigh1",
    title: "Steady Light",
    writer: "Ada Vance",
    year: 2024,
    themes: "Hope",
    songKey: "D",
    bpm: 82,
    timeSignature: "3/4",
    language: "English",
    scripture: "",
    license: "WC",
    authorId: "adavance001",
    fileUrls: { art: "https://cdn.example.test/steady-light/art.webp" },
    chordPro: "Chorus\n[D]Steady light",
    publishedAt: "2025-01-15T00:00:00.000Z"
  }
];

const jsonLdOf = (html) => JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);

test("Google tag stays in the shell and in prerendered pages", () => {
  const tag = "https://www.googletagmanager.com/gtag/js?id=G-3QX5XDY16J";
  assert.match(shell.slice(0, shell.indexOf("</head>")), new RegExp(tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(shell, /gtag\('config', 'G-3QX5XDY16J'\)/);
  assert.match(songPage(shell, SONGS[0], SONGS, SITE), /G-3QX5XDY16J/);
  assert.match(page(shell, { title: "Song library", description: "All songs", canonical: `${SITE}/songs/`, body: "<main></main>", site: SITE }), /G-3QX5XDY16J/);
});

test("PD song body is US-centric and never says Free for churches", () => {
  const pd = songBody(SONGS[0]);
  assert.match(pd, /Public domain in the United States \(best-effort\)/);
  assert.match(pd, /including commercial/);
  assert.doesNotMatch(pd, /Free for churches/);
  const wc = songBody(SONGS[2]);
  assert.match(wc, /Shared through WorshipCommons/);
  assert.doesNotMatch(wc, /Public domain/);
});

test("hreflang alternates cover the translated family", () => {
  const original = songPage(shell, SONGS[0], SONGS, SITE);
  assert.match(original, /<link rel="alternate" hreflang="en" href="https:\/\/example\.test\/songs\/rock-of-ages-RockOfAges1\/">/);
  assert.match(original, /<link rel="alternate" hreflang="es" href="https:\/\/example\.test\/songs\/roca-de-la-eternidad-RocaEtern01\/">/);
  assert.match(original, /<link rel="alternate" hreflang="x-default" href="https:\/\/example\.test\/songs\/rock-of-ages-RockOfAges1\/">/);

  // the translation advertises the same family and the same x-default
  const translation = songPage(shell, SONGS[1], SONGS, SITE);
  assert.match(translation, /hreflang="en" href="https:\/\/example\.test\/songs\/rock-of-ages-RockOfAges1\/"/);
  assert.match(translation, /hreflang="x-default" href="https:\/\/example\.test\/songs\/rock-of-ages-RockOfAges1\/"/);
  assert.match(translation, /<link rel="canonical" href="https:\/\/example\.test\/songs\/roca-de-la-eternidad-RocaEtern01\/">/);

  // a song with no siblings gets no hreflang alternates (the shell still has the Atom feed link)
  assert.doesNotMatch(songPage(shell, SONGS[2], SONGS, SITE), /rel="alternate" hreflang=/);
});

test("JSON-LD carries the translation graph and licensing", () => {
  const original = jsonLdOf(songPage(shell, SONGS[0], SONGS, SITE));
  assert.equal(original["@type"], "MusicComposition");
  assert.equal(original.url, `${SITE}/songs/rock-of-ages-RockOfAges1/`);
  assert.equal(original.musicalKey, "G");
  assert.equal(original.keywords, "Grace, Refuge");
  assert.equal(original.license, "https://creativecommons.org/publicdomain/mark/1.0/");
  assert.equal(original.translationOfWork, undefined);
  assert.equal(original.isAccessibleForFree, true);
  assert.deepEqual(original.workTranslation, [
    {
      "@type": "MusicComposition",
      name: "Roca de la Eternidad",
      url: `${SITE}/songs/roca-de-la-eternidad-RocaEtern01/`,
      inLanguage: "es"
    }
  ]);

  const translation = jsonLdOf(songPage(shell, SONGS[1], SONGS, SITE));
  assert.deepEqual(translation.translationOfWork, {
    "@type": "MusicComposition",
    name: "Rock of Ages",
    url: `${SITE}/songs/rock-of-ages-RockOfAges1/`,
    inLanguage: "en"
  });
  assert.equal(translation.workTranslation, undefined);

  // writer-shared songs point at the WorshipCommons license instead
  assert.equal(jsonLdOf(songPage(shell, SONGS[2], SONGS, SITE)).license, `${SITE}/license/`);
  const blocks = [...songPage(shell, SONGS[0], SONGS, SITE).matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(m => JSON.parse(m[1]));
  assert.equal(blocks[1]["@type"], "BreadcrumbList");
  assert.equal(blocks[1].itemListElement[2].item, `${SITE}/songs/rock-of-ages-RockOfAges1/`);
});

test("share card meta uses the site base and the song image", () => {
  const html = songPage(shell, SONGS[2], SONGS, SITE);
  assert.match(html, /<meta property="og:image" content="https:\/\/example\.test\/og\/SteadyLigh1\.png">/);
  assert.match(html, /<meta property="og:image:width" content="1200">/);
  assert.match(html, /<meta property="og:image:height" content="630">/);
  assert.match(html, /<meta property="og:image:alt" content="Steady Light — Ada Vance">/);
  assert.match(html, /<meta name="twitter:image" content="https:\/\/example\.test\/og\/SteadyLigh1\.png">/);
  assert.match(html, /<meta name="twitter:title" content="Steady Light — free chords/);
  assert.match(html, /<meta name="twitter:description" content="Free chord chart/);
  assert.match(html, /<meta property="og:type" content="music.song">/);

  // the hardcoded production og:image in index.html is rebased, never left behind
  const listing = page(shell, { title: "Song library", description: "All songs", canonical: `${SITE}/songs/`, body: "<main></main>", site: SITE });
  assert.match(listing, /<meta property="og:image" content="https:\/\/example\.test\/og\/site\.png">/);
  assert.doesNotMatch(listing, /worshipcommons\.org/);
});

test("sitemap lists every page with lastmod", () => {
  const xml = sitemapXml(SONGS, SITE);
  assert.match(xml, /<url><loc>https:\/\/example\.test\/songs\/rock-of-ages-RockOfAges1\/<\/loc><lastmod>2024-03-01<\/lastmod><\/url>/);
  assert.match(xml, /<loc>https:\/\/example\.test\/songs\/roca-de-la-eternidad-RocaEtern01\/<\/loc><lastmod>2024-04-02<\/lastmod>/); // falls back to createdAt
  assert.match(xml, /<loc>https:\/\/example\.test\/terms\/<\/loc>/);
  assert.match(xml, /<loc>https:\/\/example\.test\/new\/<\/loc>/);
  assert.match(xml, /<loc>https:\/\/example\.test\/mission\/<\/loc>/);
  assert.match(xml, /<loc>https:\/\/example\.test\/license\/<\/loc>/);
  assert.match(xml, /<loc>https:\/\/example\.test\/upload\/<\/loc>/);
  assert.match(xml, /<loc>https:\/\/example\.test\/call-for-songs\/<\/loc>/);
  // collections with songs: /hymns/ (Rock of Ages) and /no-ccli/ (all three)
  assert.match(xml, /<loc>https:\/\/example\.test\/hymns\/<\/loc><lastmod>2024-03-01<\/lastmod>/);
  assert.match(xml, /<loc>https:\/\/example\.test\/no-ccli\/<\/loc>/);
  assert.doesNotMatch(xml, /\/songs\/christmas\//);
  // single-song people are noindex and stay out; credit-string pages are gone
  assert.doesNotMatch(xml, /\/writers\//);
  assert.equal(xml.match(/<loc>/g).length, 9 + 2 + SONGS.length);
});

test("sitemap lists a writer once they have two songs, under their person URL", () => {
  const second = { ...SONGS[0], id: "Toplady0002", title: "A Debtor to Mercy Alone", writer: "Augustus M. Toplady · tr. Jan Foss", authorId: "toplady0002", publishedAt: "2024-05-01T00:00:00.000Z" };
  const xml = sitemapXml([...SONGS, second], SITE);
  // "Augustus M. Toplady" and "Augustus Toplady" are one person; on a tie the fuller spelling names the page
  assert.match(xml, new RegExp(`<loc>${SITE}/writers/augustus-m-toplady-${personId("Augustus Toplady")}/</loc><lastmod>2024-05-01</lastmod>`));
  assert.equal(xml.match(/\/writers\//g).length, 1);
  assert.doesNotMatch(xml, /jan-foss/);
  assert.doesNotMatch(xml, /toplady0001|toplady0002/);
});

test("sitemap percent-encodes non-ASCII URLs", () => {
  const song = { ...SONGS[2], id: "NateShenjt1", title: "Natë e Shenjtë", language: "Albanian" };
  assert.match(sitemapXml([song], SITE), /<loc>https:\/\/example\.test\/songs\/nat%C3%AB-e-shenjt%C3%AB-NateShenjt1\/<\/loc>/);
});

test("static SPA routes write crawlable HTML under build/<route>/index.html", () => {
  const slugs = staticPages(SONGS, SITE).map(p => p.slug);
  assert.deepEqual(slugs, ["mission", "license", "terms", "upload", "new", "call-for-songs", "report"]);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wc-prerender-"));
  try {
    writeStaticPages(dir, shell, SONGS, SITE);
    for (const slug of slugs) {
      const html = fs.readFileSync(path.join(dir, slug, "index.html"), "utf8");
      assert.match(html, /<div id="root">/);
      assert.match(html, new RegExp(`<link rel="canonical" href="${SITE}/${slug}/">`));
    }
    assert.match(fs.readFileSync(path.join(dir, "mission", "index.html"), "utf8"), /Worship music does not belong on an invoice/);
    const license = fs.readFileSync(path.join(dir, "license", "index.html"), "utf8");
    assert.match(license, /<title>The WorshipCommons License — WorshipCommons<\/title>/);
    assert.match(license, /WorshipCommons License, Version 1.0 — Legal Code/);
    assert.match(license, /The Writer grants everyone a free, worldwide, non-exclusive, perpetual, irrevocable license/);
    const terms = fs.readFileSync(path.join(dir, "terms", "index.html"), "utf8");
    assert.match(terms, /micheal@livechurchsolutions\.org/);
    assert.match(terms, /DMCA-1080721/);
    assert.match(terms, /LIVE CHURCH SOLUTIONS INC/);
    assert.match(terms, /918-994-2638/);
    assert.match(fs.readFileSync(path.join(dir, "upload", "index.html"), "utf8"), /Sign in to share your song/);
    assert.match(fs.readFileSync(path.join(dir, "new", "index.html"), "utf8"), /Steady Light/);
    const call = fs.readFileSync(path.join(dir, "call-for-songs", "index.html"), "utf8");
    assert.match(call, /Call for songs/);
    assert.match(call, /give churches this song forever/);
    assert.match(call, /You must be 18 or older/);
    assert.doesNotMatch(call, /seminary students/);
    assert.doesNotMatch(call, /first published song/);
    const report = fs.readFileSync(path.join(dir, "report", "index.html"), "utf8");
    assert.match(report, /Report a song/);
    assert.match(report, /support@churchapps\.org/);
    assert.doesNotMatch(report, /support@worshipcommons\.org/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("llms.txt and robots.txt invite the AI crawlers", () => {
  const llms = llmsTxt(SONGS, SITE);
  assert.match(llms, /^# WorshipCommons/);
  assert.match(llms, /Full terms: https:\/\/example\.test\/license/);
  assert.match(llms, /- \[Song library\]\(https:\/\/example\.test\/songs\/\)/);
  assert.match(llms, /- \[Mission\]\(https:\/\/example\.test\/mission\/\)/);
  assert.match(llms, /- \[Public domain hymns\]\(https:\/\/example\.test\/hymns\/\)/);
  assert.match(llms, /\n## Songs\n/);
  assert.match(llms, /- \[Rock of Ages by Augustus Toplady\]\(https:\/\/example\.test\/songs\/rock-of-ages-RockOfAges1\/\)/);
  assert.match(llms, /- \[Steady Light by Ada Vance\]\(https:\/\/example\.test\/songs\/steady-light-SteadyLigh1\/\)/);
  assert.doesNotMatch(llms, /feed\.xml/);
  assert.match(llmsTxt(SONGS, SITE, true), /- \[Feed\]\(https:\/\/example\.test\/feed\.xml\)/);

  const robots = robotsTxt(SITE);
  for (const agent of ["*", "GPTBot", "ClaudeBot", "CCBot", "Google-Extended", "PerplexityBot"]) {
    assert.ok(robots.includes(`User-agent: ${agent}\nAllow: /`), `robots.txt is missing ${agent}`);
  }
  assert.match(robots, /Sitemap: https:\/\/example\.test\/sitemap\.xml/);
});

test("a second song in the same language does not emit a second hreflang", () => {
  const alt = { ...SONGS[0], id: "RockOfAges2", title: "Rock of Ages (alt)", parentSongId: "RockOfAges1" };
  const html = songPage(shell, SONGS[0], [...SONGS, alt], SITE);
  const en = [...html.matchAll(/hreflang="en" href="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(en, [`${SITE}/songs/rock-of-ages-RockOfAges1/`]);
  assert.equal(langIso("Swedish"), "sv");
  assert.equal(langIso("Chinese"), "zh");
  assert.equal(langIso("Klingon"), "");
});

test("homepage prerender keeps the current title and social description", () => {
  const html = homePage(shell, SITE);
  assert.match(html, /<title>WorshipCommons — Worship music, set free<\/title>/);
  assert.match(html, /public domain hymns and writer-shared songs with chord charts/);
  assert.doesNotMatch(html, /no licenses, no strings/i);
  assert.doesNotMatch(html, /no licenses needed/i);
  assert.match(html, /og:description" content="Free worship songs for your church: chord charts, lyrics, any key\./);
  assert.match(html, /<link rel="canonical" href="https:\/\/example\.test\/">/);
  assert.match(html, /<h1>Great music\. For every church\.<\/h1>/);
  assert.match(html, /Freely given\. Freely shared\./);
  assert.match(html, /<form action="\/songs\/" method="get"/);
  assert.match(html, /"@type":"WebSite"/);
  assert.match(html, /search_term_string/);
  assert.match(html, /A service of ChurchApps/);
  assert.doesNotMatch(html, /worshipcommons\.org/);
  assert.equal(html.match(/rel="canonical"/g).length, 1);
});

test("song share cards do not say no license is needed", () => {
  const html = songPage(shell, SONGS[0], SONGS, SITE);
  const desc = html.match(/<meta name="description" content="([^"]*)"/)[1];
  const og = html.match(/<meta property="og:description" content="([^"]*)"/)[1];
  assert.equal(og, desc);
  assert.match(desc, /sing it in worship/);
  assert.doesNotMatch(desc, /no license needed/i);
});

test("writer pages are per person, noindex below two songs, and account pages are noindex", () => {
  const second = { ...SONGS[0], id: "Toplady0002", title: "A Debtor to Mercy Alone", writer: "Augustus Toplady & Ada Vance", authorId: "toplady0002", writerBio: "Shared bio." };
  const songs = [{ ...SONGS[0], writerBio: "Augustus Montague Toplady was an English Anglican cleric." }, SONGS[1], SONGS[2], second];
  const persons = personsOf(songs);
  const toplady = persons.find(p => p.name === "Augustus Toplady");
  assert.equal(toplady.songs.length, 2);
  assert.equal(toplady.indexable, true);
  const html = writerPage(shell, toplady, persons, SITE);
  assert.match(html, /<title>Augustus Toplady — songs, chords and lyrics \| WorshipCommons<\/title>/);
  assert.match(html, new RegExp(`<link rel="canonical" href="${SITE}${toplady.path}/">`));
  assert.match(html, /<h1>Augustus Toplady<\/h1>/);
  assert.match(html, /Augustus Montague Toplady was an English Anglican cleric\./); // solo-credit bio only
  assert.doesNotMatch(html, /Shared bio/);
  assert.match(html, /href="\/songs\/rock-of-ages-RockOfAges1\/"/);
  assert.match(html, /<h2>Wrote with<\/h2><p><a href="\/writers\/ada-vance-[^"]+\/">Ada Vance<\/a>/);
  assert.match(html, /"@type":"ProfilePage"/);
  assert.doesNotMatch(html, /name="robots"/);
  const ada = persons.find(p => p.name === "Ada Vance");
  assert.equal(ada.indexable, true);
  const westrup = persons.find(p => p.name === "T. M. Westrup");
  assert.match(writerPage(shell, westrup, persons, SITE), /<meta name="robots" content="noindex, follow">/);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wc-writers-"));
  try {
    writeWriterPages(dir, shell, songs, SITE);
    const at = (p) => fs.readFileSync(path.join(dir, p, "index.html"), "utf8");
    assert.match(at(toplady.path), /<h1>Augustus Toplady<\/h1>/);
    // a one-person credit URL, slugged or bare id, redirects to the person
    assert.match(at("writers/augustus-toplady-toplady0001"), new RegExp(`<meta http-equiv="refresh" content="0; url=${SITE}${toplady.path}/">`));
    assert.match(at("writers/toplady0001"), new RegExp(`<link rel="canonical" href="${SITE}${toplady.path}/">`));
    // a shared credit keeps a noindex page that links each person
    const shared = at("writers/augustus-toplady-ada-vance-toplady0002");
    assert.match(shared, /<meta name="robots" content="noindex, follow">/);
    assert.match(shared, new RegExp(`href="${toplady.path}/">Augustus Toplady</a>`));
    assert.match(at("writers/toplady0002"), /url=https:\/\/example\.test\/writers\/augustus-toplady-ada-vance-toplady0002\//);
    writeGatedPages(dir, shell, SITE);
    const login = at("login");
    assert.match(login, /<meta name="robots" content="noindex, follow">/);
    assert.match(login, /<h1>Welcome back<\/h1>/);
    assert.match(login, /<link rel="canonical" href="https:\/\/example\.test\/login\/">/);
    const saved = at("library");
    assert.match(saved, /Songs you’ve saved/);
    assert.match(saved, /noindex, follow/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("song pages link each credited person and split the composer in JSON-LD", () => {
  const song = { ...SONGS[0], id: "Debtor00001", title: "A Debtor to Mercy", writer: "Augustus Toplady & Ada Vance · tr. Jan Foss" };
  const songs = [...SONGS, song];
  const persons = personsOf(songs);
  const body = songBody(song, persons);
  assert.match(body, new RegExp(`<p>By <a href="${personPath("Augustus Toplady")}/">Augustus Toplady</a> &amp; <a href="${personPath("Ada Vance")}/">Ada Vance</a> · tr\\. <a href="${personPath("Jan Foss")}/">Jan Foss</a> · 1763</p>`));
  assert.doesNotMatch(body, /Words and music by/);
  const ld = creditJsonLd(song, persons, SITE);
  assert.deepEqual(ld.composer.map(p => p.name), ["Augustus Toplady", "Ada Vance"]);
  assert.equal(ld.composer[0].url, `${SITE}${personPath("Augustus Toplady")}/`);
  assert.equal(ld.translator.name, "Jan Foss");
  // a collective credit is not a Person
  const trad = creditJsonLd({ writer: "Traditional" }, persons, SITE);
  assert.equal(trad.composer, undefined);
  assert.equal(trad.creditText, "Traditional");
  assert.match(songBody({ ...SONGS[0], writer: "Traditional", authorId: "trad0000001" }, persons), /By <a href="\/writers\/traditional-trad0000001\/">Traditional<\/a>/);
});

test("bare song ids redirect to the slugged URL", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wc-legacy-"));
  try {
    writeLegacySongRedirects(dir, SONGS, SITE);
    const html = fs.readFileSync(path.join(dir, "songs", "RockOfAges1", "index.html"), "utf8");
    assert.match(html, /<meta http-equiv="refresh" content="0; url=https:\/\/example\.test\/songs\/rock-of-ages-RockOfAges1\/">/);
    assert.match(html, /<link rel="canonical" href="https:\/\/example\.test\/songs\/rock-of-ages-RockOfAges1\/">/);
    assert.match(html, /location\.replace\("https:\/\/example\.test\/songs\/rock-of-ages-RockOfAges1\/" \+ location\.search \+ location\.hash\)/);
    assert.doesNotMatch(html, /noindex/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  assert.doesNotMatch(redirectPage("https://x.test/a\"><script>"), /"><script>/);
});

test("the SPA fallback is noindex with no canonical", () => {
  const home = homePage(shell, SITE);
  const fallback = spaFallbackPage(shell);
  assert.match(fallback, /<meta name="robots" content="noindex">/);
  assert.doesNotMatch(fallback, /rel="canonical"/);
  assert.doesNotMatch(fallback, /og:url/);
  assert.match(fallback, /<div id="root"><\/div>/);
  assert.match(home, /<link rel="canonical" href="https:\/\/example\.test\/">/);
  assert.doesNotMatch(home, /noindex/);
});

test("collection pages list their songs with the shared copy and skip empty ones", () => {
  const xmas = { ...SONGS[2], id: "SilentNigh1", title: "Silent Night", writer: "Joseph Mohr", year: 1818, license: "PD", themes: "Christmas, Peace" };
  const songs = [...SONGS, xmas];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wc-collections-"));
  try {
    writeCollectionPages(dir, shell, songs, SITE);
    const hymns = fs.readFileSync(path.join(dir, "hymns", "index.html"), "utf8");
    assert.match(hymns, /<link rel="canonical" href="https:\/\/example\.test\/hymns\/">/);
    assert.match(hymns, /<h1>Public domain hymns<\/h1>/);
    assert.match(hymns, /href="\/songs\/rock-of-ages-RockOfAges1\/">Rock of Ages<\/a>/);
    assert.doesNotMatch(hymns, /Roca de la Eternidad/); // English only
    assert.doesNotMatch(hymns, /Steady Light/); // WorshipCommons License, not public domain
    assert.match(hymns, /"@type":"CollectionPage"/);
    const christmas = fs.readFileSync(path.join(dir, "songs", "christmas", "index.html"), "utf8");
    assert.match(christmas, /Silent Night/);
    assert.doesNotMatch(christmas, /Rock of Ages/);
    const noCcli = fs.readFileSync(path.join(dir, "no-ccli", "index.html"), "utf8");
    assert.match(noCcli, /"@type":"FAQPage"/);
    assert.match(noCcli, /Steady Light/);
    assert.equal(fs.existsSync(path.join(dir, "songs", "easter")), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  assert.ok(COLLECTIONS.every(c => indexablePath(c.path)), "every collection must be indexable in the SPA crawl policy");
  assert.match(collectionPage(shell, collectionBySlug("advent"), songs, SITE), /<title>Advent hymns and songs for church/);
});

test("crawl policy indexes songs and writers and hides account and print views", () => {
  assert.equal(indexablePath("/"), true);
  assert.equal(indexablePath("/songs/rock-of-ages-RockOfAges1"), true);
  assert.equal(indexablePath("/writers/augustus-toplady-toplady0001/"), true);
  assert.equal(indexablePath("/mission"), true);
  assert.equal(indexablePath("/login"), false);
  assert.equal(indexablePath("/library"), false);
  assert.equal(indexablePath("/setlists/shared"), false);
  assert.equal(indexablePath("/songs/rock-of-ages-RockOfAges1/print"), false);
  assert.equal(indexablePath("/preview/submission/abc"), false);
  assert.equal(indexablePath("/this-page-does-not-exist"), false);
  assert.equal(canonicalPath("/songs/rock-of-ages-RockOfAges1"), "/songs/rock-of-ages-RockOfAges1/");
  assert.equal(canonicalPath("/"), "/");
});

test("slugged paths round-trip through idOf", () => {
  assert.equal(songPath({ id: "fq-OAk1yMgA", title: "On What Has Now Been Sown" }), "/songs/on-what-has-now-been-sown-fq-OAk1yMgA");
  assert.equal(idOf("on-what-has-now-been-sown-fq-OAk1yMgA"), "fq-OAk1yMgA");
  assert.equal(idOf("fq-OAk1yMgA"), "fq-OAk1yMgA");
  assert.equal(idOf("John Newton"), "John Newton");
  assert.equal(writerPath("71c9ff4e9f8", "John Newton"), "/writers/john-newton-71c9ff4e9f8");
  assert.equal(idOf("john-newton-71c9ff4e9f8"), "71c9ff4e9f8");
});
