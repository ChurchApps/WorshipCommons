// Post-build prerender: stamps out static, crawlable HTML for every song page
// plus /songs, sitemap.xml, and robots.txt. React replaces the static content
// on load (createRoot, not hydrate), so markup only needs to be good for
// crawlers and no-JS readers.
// Usage: node tools/prerender.mjs [apiBase] [siteBase]
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import { coverSvg } from "../src/cover.mjs";

const API = (process.argv[2] || "http://localhost:8098").replace(/\/$/, "");
const SITE = (process.argv[3] || "https://worshipcommons.org").replace(/\/$/, "");
const BUILD = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "build");

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const stripChords = (chordPro) => (chordPro || "").replace(/\[[^\]]*\]/g, "");

function stanzas(chordPro) {
  return stripChords(chordPro).split(/\n\s*\n/).map(block => {
    const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
    return { label: lines[0] || "", lines: lines.slice(1) };
  }).filter(s => s.lines.length > 0);
}

function page(shell, { title, description, canonical, ogImage, jsonLd, body }) {
  let html = shell
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(">)/, `$1${esc(description)}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(">)/, `$1${esc(title)}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(">)/, `$1${esc(description)}$2`);
  if (ogImage) html = html.replace(/(<meta property="og:image" content=")[^"]*(">)/, `$1${ogImage}$2`);
  let head = `<link rel="canonical" href="${canonical}">\n<meta property="og:url" content="${canonical}">\n`;
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

async function fetchJson(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`${url} → ${resp.status}`);
  return resp.json();
}

async function run() {
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
    const url = `${SITE}/songs/${song.id}/`;
    await sharp(Buffer.from(coverSvg(song, 1200, 630))).png().toFile(path.join(ogDir, `${song.id}.png`));
    const html = page(shell, {
      title: `${song.title} — free chords and lyrics | WorshipCommons`,
      description: `Free chord chart, lyrics, and melody for ${song.title} (${song.writer}, ${song.year}). Transpose to any key, print it, project it, sing it — no license needed.`,
      canonical: url,
      ogImage: `${SITE}/og/${song.id}.png`,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "MusicComposition",
        name: song.title,
        composer: { "@type": "Person", name: song.writer },
        copyrightYear: song.year,
        inLanguage: song.language,
        lyrics: { "@type": "CreativeWork", text: stripChords(song.chordPro) }
      },
      body: songBody(song)
    });
    const dir = path.join(BUILD, "songs", song.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), html);
  }

  const listBody = `<main style="max-width:700px;margin:0 auto;padding:40px 24px"><h1>Song library</h1><ul>` +
    songs.map(s => `<li><a href="/songs/${s.id}/">${esc(s.title)}</a> — ${esc(s.writer)}, ${esc(s.year)}</li>`).join("") +
    `</ul></main>`;
  fs.writeFileSync(path.join(BUILD, "songs", "index.html"), page(shell, {
    title: "Song library — WorshipCommons",
    description: "Search free worship songs by theme, scripture, key, tempo, or language. Chord charts and lyrics in any key, no licenses needed.",
    canonical: `${SITE}/songs/`,
    body: listBody
  }));

  const urls = [`${SITE}/`, `${SITE}/songs/`, `${SITE}/license`, `${SITE}/report`, ...songs.map(s => `${SITE}/songs/${s.id}/`)];
  fs.writeFileSync(path.join(BUILD, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map(u => `  <url><loc>${esc(u)}</loc></url>`).join("\n") + `\n</urlset>\n`);
  fs.writeFileSync(path.join(BUILD, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);

  console.log(`Prerendered ${songs.length} song pages + /songs, sitemap.xml, robots.txt (${SITE})`);
}

run().catch(err => { console.error("Prerender failed:", err.message || err); process.exit(1); });
