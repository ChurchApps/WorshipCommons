// Generative "engraved plate" cover art, shared by the React app and tools/prerender.mjs.
// Deterministic per song: id seeds the linework, the default key picks the colorway
// (violet→gold arc), BPM sets the line energy, themes/title pick the motif.

const ACCENT = "#D9F154";
const INK = "#17121F";
const NOTE_IDX = { "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11 };

const hash = (s) => {
  let h = 2166136261;
  for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

const rng = (seed) => {
  let s = (seed % 2147483647) || 7;
  return () => (s = (Math.imul(s, 48271) >>> 0) % 2147483647) / 2147483647;
};

const keyHues = (key) => {
  const i = NOTE_IDX[String(key || "C").replace(/m$/, "")] ?? 0;
  const h = 250 + i * 16; // violet (C) → gold (B): warm and on-brand for all 12 keys
  return { a: `hsl(${h} 78% 66%)`, b: `hsl(${h + 42} 88% 62%)`, sun: `hsl(${h + 64} 90% 62%)` };
};

const motifFor = (text) => {
  const t = String(text).toLowerCase();
  if (/river|water|well|sea|rain|stream|fountain/.test(t)) return "waves";
  if (/grace|mercy|amazing/.test(t)) return "arcs";
  if (/holy|praise|glory|majesty|adoration/.test(t)) return "peaks";
  if (/hope|vision|morning|light|rise|dawn/.test(t)) return "rays";
  return "waves";
};

function motifPath(motif, r, w, h, i, n, en) {
  const pts = [];
  const y0 = h * (0.10 + 0.84 * i / n);
  if (motif === "waves") {
    const amp = ((h * 0.02) + r() * h * 0.045) * en, ph = r() * 6.28, fr = (1.2 + r() * 2.2) * en;
    for (let x = 0; x <= 32; x++) pts.push([w * x / 32, y0 + amp * Math.sin(fr * x / 32 * 6.28 + ph)]);
  } else if (motif === "arcs") {
    const cy = h * 1.15, rad = h * 1.05 * (1 - i / n) + h * 0.08;
    for (let x = 0; x <= 32; x++) { const t = -1.35 + 2.7 * x / 32; pts.push([w / 2 + rad * Math.sin(t), cy - rad * Math.cos(t)]); }
  } else if (motif === "peaks") {
    const amp = (h * 0.05 + r() * h * 0.09) * en, ph = r() * 6.28, fr = (2 + r() * 2) * en;
    for (let x = 0; x <= 32; x++) { const t = fr * x / 32 * 6.28 + ph; pts.push([w * x / 32, y0 + amp * (2 * Math.abs(((t / 3.14) % 2) - 1) - 1)]); }
  } else { // rays
    const cx = w * 0.5, cy = h * 0.88, ang = -3.14 + 3.14 * i / n, len = h * (0.55 + r() * 0.5);
    pts.push([cx, cy], [cx + len * Math.cos(ang), cy + len * Math.sin(ang)]);
  }
  return "M" + pts.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" L");
}

let gid = 0;
export function coverSvg(song, w, h) {
  const seed = hash(song.id || song.title || "wc");
  const r = rng(seed);
  const n = 22;
  const k = keyHues(song.songKey);
  const motif = motifFor((song.title || "") + " " + (song.themes || ""));
  const en = Math.min(1.45, Math.max(0.6, (song.bpm || 88) / 88));
  const grad = `wcg${seed % 100000}_${gid++}`;
  let lines = "";
  for (let i = 0; i < n; i++) {
    lines += `<path d="${motifPath(motif, r, w, h, i, n, en)}" fill="none" stroke="url(#${grad})" stroke-width="${(1 + i / n).toFixed(2)}" opacity="${(0.22 + 0.75 * i / n).toFixed(2)}"/>`;
  }
  const sx = (w * (0.6 + r() * 0.25)).toFixed(0), sy = (h * (0.2 + r() * 0.18)).toFixed(0);
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">` +
    `<defs><linearGradient id="${grad}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${k.a}"/><stop offset="1" stop-color="${k.b}"/></linearGradient></defs>` +
    `<rect width="${w}" height="${h}" fill="${INK}"/>${lines}` +
    `<circle cx="${sx}" cy="${sy}" r="${(h * 0.085).toFixed(0)}" fill="${k.sun}" opacity="0.9"/>` +
    `<circle cx="${sx}" cy="${sy}" r="${(h * 0.13).toFixed(0)}" fill="none" stroke="${ACCENT}" stroke-width="1.4" opacity="0.7"/>` +
    `</svg>`;
}
