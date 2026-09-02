// Post-build prerender: stamps out static, crawlable HTML for every song page
// plus /songs, sitemap.xml, robots.txt, llms.txt, and feed.xml. React replaces the static
// content on load (createRoot, not hydrate), so markup only needs to be good for
// crawlers and no-JS readers.
// The page/sitemap/llms builders are exported so tools/prerender.test.mjs can
// assert on the emitted markup without touching the network.
// Usage: node tools/prerender.mjs [apiBase] [siteBase]
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import { coverSvg } from "../src/cover.mjs";

const BUILD = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "build");
const DEFAULT_SITE = "https://worshipcommons.org";

// song language name → ISO code, mirroring LANGS in src/i18n.tsx
const LANG_ISO = { English: "en", Spanish: "es", German: "de", French: "fr", Portuguese: "pt", Russian: "ru", Hungarian: "hu", Albanian: "sq", Malayalam: "ml" };
export const langIso = (name) => LANG_ISO[name] || String(name || "en").slice(0, 2).toLowerCase();

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const stripChords = (chordPro) => (chordPro || "").replace(/\[[^\]]*\]/g, "");

function stanzas(chordPro) {
  return stripChords(chordPro).split(/\n\s*\n/).map(block => {
    const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
    return { label: lines[0] || "", lines: lines.slice(1) };
  }).filter(s => s.lines.length > 0);
}

const songUrl = (site, id) => `${site}/songs/${id}/`;

const lastmod = (song) => {
  const t = Date.parse(song.publishedAt || song.createdAt || "");
  return Number.isNaN(t) ? "" : new Date(t).toISOString().slice(0, 10);
};

export function page(shell, { title, description, canonical, ogImage, ogImageAlt, jsonLd, body, alternates = [], site = DEFAULT_SITE }) {
  let html = shell
    .split(`${DEFAULT_SITE}/og/`).join(`${site}/og/`)
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(">)/, `$1${esc(description)}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(">)/, `$1${esc(title)}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(">)/, `$1${esc(description)}$2`);
  if (ogImage) html = html.replace(/(<meta property="og:image" content=")[^"]*(">)/, `$1${ogImage}$2`);
  let head = `<link rel="canonical" href="${canonical}">\n<meta property="og:url" content="${canonical}">\n`;
  for (const alt of alternates) head += `<link rel="alternate" hreflang="${esc(alt.hreflang)}" href="${alt.href}">\n`;
  if (ogImage) {
    head += `<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n`;
    head += `<meta property="og:image:alt" content="${esc(ogImageAlt || title)}">\n<meta name="twitter:image" content="${ogImage}">\n`;
  }
  head += `<meta name="twitter:title" content="${esc(title)}">\n<meta name="twitter:description" content="${esc(description)}">\n`;
  if (jsonLd) head += `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>\n`;
  return html
    .replace("</head>", head + "</head>")
    .replace('<div id="root"></div>', `<div id="root">${body}</div>`);
}

function songBody(song) {
  const parts = [
    `<main style="max-width:700px;margin:0 auto;padding:40px 24px;font-family:Georgia,serif">`,
    `<p><a href="/songs/">← All songs</a></p>`,
    `<h1>${esc(song.title)}</h1>`,
    `<p>Words and music by ${esc(song.writer)} · ${esc(song.year)}</p>`,
    `<p>Key of ${esc(song.songKey)} · ${esc(song.bpm)} BPM · ${esc(song.timeSignature)} · ${esc(song.themes)}${song.scripture ? ` · ${esc(song.scripture)}` : ""}</p>`
  ];
  for (const st of stanzas(song.chordPro)) {
    parts.push(`<section><h2 style="font-size:14px;text-transform:uppercase">${esc(st.label)}</h2>`);
    parts.push(`<p>${st.lines.map(esc).join("<br>")}</p></section>`);
  }
  parts.push(song.license === "PD"
    ? `<p>Public domain. Free for churches.</p>`
    : `<p>© ${esc(song.year)} ${esc(song.writer)} · Shared through WorshipCommons — free for worship everywhere, always.</p>`);
  parts.push(`</main>`);
  return parts.join("\n");
}

// every song sharing a family root (the original, or the song a translation points at)
// gets an hreflang alternate; x-default sends crawlers to the original
export function songAlternates(song, songs, site = DEFAULT_SITE) {
  const familyId = song.parentSongId || song.id;
  const family = songs.filter(s => (s.parentSongId || s.id) === familyId);
  if (family.length < 2) return [];
  const root = family.find(s => s.id === familyId) || family[0];
  return [
    ...family.map(s => ({ hreflang: langIso(s.language), href: songUrl(site, s.id) })),
    { hreflang: "x-default", href: songUrl(site, root.id) }
  ];
}

export function songPage(shell, song, songs, site = DEFAULT_SITE) {
  const url = songUrl(site, song.id);
  const parent = song.parentSongId ? songs.find(s => s.id === song.parentSongId) : null;
  const translations = songs.filter(s => s.parentSongId === song.id);
  const work = (s) => ({ "@type": "MusicComposition", name: s.title, url: songUrl(site, s.id), inLanguage: s.language });
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MusicComposition",
    name: song.title,
    url,
    composer: { "@type": "Person", name: song.writer },
    copyrightYear: song.year,
    inLanguage: song.language,
    musicalKey: song.songKey,
    keywords: song.themes,
    license: song.license === "PD" ? "https://creativecommons.org/publicdomain/mark/1.0/" : `${site}/license`,
    lyrics: { "@type": "CreativeWork", text: stripChords(song.chordPro) }
  };
  if (parent) jsonLd.translationOfWork = work(parent);
  if (translations.length) jsonLd.workTranslation = translations.map(work);
  return page(shell, {
    title: `${song.title} — free chords and lyrics | WorshipCommons`,
    description: `Free chord chart, lyrics, and melody for ${song.title} (${song.writer}, ${song.year}). Transpose to any key, print it, project it, sing it — no license needed.`,
    canonical: url,
    ogImage: `${site}/og/${song.id}.png`,
    ogImageAlt: `${song.title} — ${song.writer}`,
    jsonLd,
    body: songBody(song),
    alternates: songAlternates(song, songs, site),
    site
  });
}

export function sitemapXml(songs, site = DEFAULT_SITE) {
  const writers = [...new Set(songs.map(s => s.authorId || s.writerId).filter(Boolean))];
  const entries = [
    { loc: `${site}/` },
    { loc: `${site}/songs/` },
    { loc: `${site}/new` },
    { loc: `${site}/license` },
    { loc: `${site}/terms` },
    { loc: `${site}/report` },
    ...songs.map(s => ({ loc: songUrl(site, s.id), lastmod: lastmod(s) })),
    ...writers.map(w => ({ loc: `${site}/writers/${encodeURIComponent(w)}` }))
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries.map(e => `  <url><loc>${esc(e.loc)}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ""}</url>`).join("\n") +
    `\n</urlset>\n`;
}

export function llmsTxt(songs, site = DEFAULT_SITE, hasFeed = false) {
  return [
    `# WorshipCommons`,
    ``,
    `> An open library of worship music your church can sing free — public domain hymns and writer-shared songs with chord charts, lyrics, transposition, and audio. Every song may be sung, printed, projected, recorded, and translated without a subscription or a reporting license.`,
    ``,
    `Songs marked PD are in the public domain and carry no restrictions. Everything else is shared by its writer under the WorshipCommons license: free for worship use, with attribution to the writer. Full terms: ${site}/license`,
    ``,
    `## Links`,
    ``,
    `- [Song library](${site}/songs/)`,
    `- [License](${site}/license)`,
    ...(hasFeed ? [`- [Feed](${site}/feed.xml)`] : []),
    ``,
    `## Songs`,
    ``,
    ...songs.map(s => `- [${s.title} by ${s.writer}](${songUrl(site, s.id)})`),
    ``
  ].join("\n");
}

export function robotsTxt(site = DEFAULT_SITE) {
  const agents = ["*", "GPTBot", "ClaudeBot", "CCBot", "Google-Extended", "PerplexityBot"];
  return agents.map(a => `User-agent: ${a}\nAllow: /\n`).join("\n") + `\nSitemap: ${site}/sitemap.xml\n`;
}

async function fetchJson(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`${url} → ${resp.status}`);
  return resp.json();
}

// real cover art makes a far better share card than the generated plate; fall back to it
async function writeOgImage(song, dest) {
  const art = song.fileUrls?.art || song.artUrl;
  if (art) {
    try {
      const resp = await fetch(art);
      if (!resp.ok) throw new Error(`${art} → ${resp.status}`);
      await sharp(Buffer.from(await resp.arrayBuffer())).resize(1200, 630, { fit: "cover" }).png().toFile(dest);
      return;
    } catch (err) {
      console.warn(`  og art fallback for ${song.id}: ${err.message || err}`);
    }
  }
  await sharp(Buffer.from(coverSvg(song, 1200, 630))).png().toFile(dest);
}

// Atom changelog of the newest songs, mirroring the /new page. Exported so
// tools/feed.test.mjs can assert on it without touching the network.
export function feedXml(songs, site, limit = 50) {
  const stamp = (s) => {
    const t = Date.parse(s.publishedAt || s.createdAt || "");
    return Number.isNaN(t) ? null : new Date(t).toISOString();
  };
  const recent = songs.filter(stamp).sort((a, b) => stamp(b).localeCompare(stamp(a))).slice(0, limit);
  const entries = recent.map(s => [
    `  <entry>`,
    `    <title>${esc(s.title)}</title>`,
    `    <link href="${site}/songs/${s.id}/"/>`,
    `    <id>${site}/songs/${s.id}/</id>`,
    `    <updated>${stamp(s)}</updated>`,
    `    <author><name>${esc(s.writer)}</name></author>`,
    `    <summary>${esc(`${s.title} by ${s.writer} — ${s.license === "PD" ? "public domain" : "free for worship"}, key of ${s.songKey}.`)}</summary>`,
    `  </entry>`
  ].join("\n")).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom">\n` +
    `  <title>WorshipCommons — new songs</title>\n` +
    `  <subtitle>Songs newly added to the commons.</subtitle>\n` +
    `  <id>${site}/feed.xml</id>\n` +
    `  <link rel="self" href="${site}/feed.xml"/>\n` +
    `  <link href="${site}/new"/>\n` +
    `  <updated>${recent.length ? stamp(recent[0]) : new Date(0).toISOString()}</updated>\n` +
    (entries ? entries + `\n` : "") + `</feed>\n`;
}

async function run() {
  const API = (process.argv[2] || "http://localhost:8084").replace(/\/$/, "") + "/commons";
  const SITE = (process.argv[3] || DEFAULT_SITE).replace(/\/$/, "");
  const shell = fs.readFileSync(path.join(BUILD, "index.html"), "utf8");
  const summaries = await fetchJson(`${API}/songs`);

  const songs = [];
  for (let i = 0; i < summaries.length; i += 8) {
    songs.push(...await Promise.all(summaries.slice(i, i + 8).map(s => fetchJson(`${API}/songs/${s.id}`))));
  }

  const ogDir = path.join(BUILD, "og");
  fs.mkdirSync(ogDir, { recursive: true });
  await sharp(Buffer.from(coverSvg({ id: "worshipcommons", title: "Worship music, set free", themes: "Hope", songKey: "C", bpm: 88 }, 1200, 630)))
    .png().toFile(path.join(ogDir, "site.png"));

  for (const song of songs) {
    await writeOgImage(song, path.join(ogDir, `${song.id}.png`));
    const dir = path.join(BUILD, "songs", song.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), songPage(shell, song, songs, SITE));
  }

  const listBody = `<main style="max-width:700px;margin:0 auto;padding:40px 24px"><h1>Song library</h1><ul>` +
    songs.map(s => `<li><a href="/songs/${s.id}/">${esc(s.title)}</a> — ${esc(s.writer)}, ${esc(s.year)}</li>`).join("") +
    `</ul></main>`;
  fs.writeFileSync(path.join(BUILD, "songs", "index.html"), page(shell, {
    title: "Song library — WorshipCommons",
    description: "Search free worship songs by theme, scripture, key, tempo, or language. Chord charts and lyrics in any key, no licenses needed.",
    canonical: `${SITE}/songs/`,
    body: listBody,
    site: SITE
  }));

  fs.writeFileSync(path.join(BUILD, "sitemap.xml"), sitemapXml(songs, SITE));
  fs.writeFileSync(path.join(BUILD, "robots.txt"), robotsTxt(SITE));
  fs.writeFileSync(path.join(BUILD, "feed.xml"), feedXml(songs, SITE));
  fs.writeFileSync(path.join(BUILD, "llms.txt"), llmsTxt(songs, SITE, true));

  console.log(`Prerendered ${songs.length} song pages + /songs, sitemap.xml, feed.xml, robots.txt, llms.txt (${SITE})`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch(err => { console.error("Prerender failed:", err.message || err); process.exit(1); });
}
