// Generative "engraved hymnal plate" cover art, shared by the React app and tools/prerender.mjs.
// Deterministic per song: id seeds colorway/composition, the default key picks the hue,
// BPM sets the line energy, themes/title pick the motif (seeded rotation otherwise).

const GOLD = "#B98F2E";
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

const colorway = (key, pick) => {
  const i = NOTE_IDX[String(key || "C").replace(/m$/, "")] ?? 0;
  const h = (i * 30 + 10) % 360;
  if (pick < 0.45) return { paper: `hsl(${h} 40% 92%)`, ink: `hsl(${h} 30% 26%)`, dark: false };
  if (pick < 0.75) return { paper: `hsl(${h} 30% 19%)`, ink: `hsl(${h} 32% 80%)`, dark: true };
  return { paper: `hsl(${h} 26% 58%)`, ink: `hsl(${h} 38% 15%)`, dark: false };
};

// Engraved icons: polyline segments in a unit box; the line budget cycles through
// segments with jittered offsets so each reads as etched multi-stroke linework.
// halo = unit coords for the gold ring anchor.
const ICONS = {
  cross: { halo: [0.5, 0.31], segs: [
    [[0.48, 0.12], [0.48, 0.84]], [[0.52, 0.12], [0.52, 0.84]],
    [[0.33, 0.29], [0.67, 0.29]], [[0.33, 0.33], [0.67, 0.33]]
  ] },
  // fill: woodcut-style silhouette paths in a 0..100 box (organic shapes don't read as stacked strokes)
  dove: { halo: [0.80, 0.16], fill: [
    "M7,53 C10,48 16,44 24,43 C34,41 46,43 56,47 L66,51 L88,42 C85,50 78,55 70,57 L87,63 C78,68 66,67 58,62 C46,66 32,63 22,58 C16,60 10,58 7,53 Z",
    "M8,50 L1,55 L9,56 Z",
    "M38,45 C37,34 42,20 58,10 C52,22 48,32 47,44 Z",
    "M40,46 C44,36 54,26 68,22 C58,32 50,40 48,47 Z"
  ] },
  anchor: { halo: [0.78, 0.20], segs: [
    [[0.5, 0.24], [0.5, 0.74]], [[0.36, 0.36], [0.64, 0.36]],
    [[0.5, 0.12], [0.56, 0.15], [0.58, 0.20], [0.54, 0.24], [0.46, 0.24], [0.42, 0.20], [0.44, 0.15], [0.5, 0.12]],
    [[0.26, 0.58], [0.30, 0.68], [0.38, 0.75], [0.5, 0.78]], [[0.74, 0.58], [0.70, 0.68], [0.62, 0.75], [0.5, 0.78]],
    [[0.26, 0.58], [0.22, 0.66]], [[0.74, 0.58], [0.78, 0.66]]
  ] },
  candle: { halo: [0.5, 0.29], segs: [
    [[0.45, 0.46], [0.45, 0.76]], [[0.55, 0.46], [0.55, 0.76]],
    [[0.36, 0.78], [0.64, 0.78]], [[0.40, 0.82], [0.60, 0.82]],
    [[0.5, 0.44], [0.5, 0.38]],
    [[0.5, 0.20], [0.55, 0.28], [0.53, 0.35], [0.5, 0.38], [0.47, 0.35], [0.45, 0.28], [0.5, 0.20]]
  ] },
  chalice: { halo: [0.5, 0.18], segs: [
    [[0.30, 0.32], [0.70, 0.32]],
    [[0.30, 0.32], [0.33, 0.44], [0.41, 0.52], [0.5, 0.55], [0.59, 0.52], [0.67, 0.44], [0.70, 0.32]],
    [[0.5, 0.55], [0.5, 0.70]],
    [[0.36, 0.76], [0.64, 0.76]], [[0.5, 0.70], [0.38, 0.75]], [[0.5, 0.70], [0.62, 0.75]]
  ] },
  harp: { halo: [0.78, 0.20], segs: [
    [[0.32, 0.24], [0.30, 0.44], [0.34, 0.62], [0.44, 0.74]],
    [[0.68, 0.24], [0.70, 0.44], [0.66, 0.62], [0.56, 0.74]],
    [[0.32, 0.24], [0.68, 0.24]],
    [[0.42, 0.26], [0.42, 0.68]], [[0.50, 0.26], [0.50, 0.72]], [[0.58, 0.26], [0.58, 0.68]]
  ] },
  crown: { halo: [0.5, 0.20], segs: [
    [[0.28, 0.62], [0.72, 0.62]], [[0.28, 0.68], [0.72, 0.68]],
    [[0.28, 0.62], [0.28, 0.68]], [[0.72, 0.62], [0.72, 0.68]],
    [[0.28, 0.62], [0.30, 0.38], [0.40, 0.55], [0.50, 0.34], [0.60, 0.55], [0.70, 0.38], [0.72, 0.62]]
  ] },
  mountains: { halo: [0.74, 0.26], segs: [
    [[0.10, 0.72], [0.30, 0.38], [0.44, 0.58]],
    [[0.44, 0.58], [0.56, 0.42], [0.72, 0.62]],
    [[0.36, 0.72], [0.58, 0.40], [0.90, 0.72]],
    [[0.08, 0.72], [0.92, 0.72]],
    [[0.26, 0.45], [0.30, 0.38], [0.34, 0.45]]
  ] },
  fish: { halo: [0.32, 0.26], segs: [
    [[0.14, 0.50], [0.28, 0.58], [0.46, 0.61], [0.62, 0.58], [0.74, 0.50], [0.86, 0.40]],
    [[0.14, 0.50], [0.28, 0.42], [0.46, 0.39], [0.62, 0.42], [0.74, 0.50], [0.86, 0.60]]
  ] },
  book: { halo: [0.5, 0.20], segs: [
    [[0.22, 0.40], [0.34, 0.36], [0.48, 0.40]], [[0.48, 0.40], [0.62, 0.36], [0.78, 0.40]],
    [[0.22, 0.62], [0.34, 0.58], [0.48, 0.62]], [[0.48, 0.62], [0.62, 0.58], [0.78, 0.62]],
    [[0.22, 0.40], [0.22, 0.62]], [[0.78, 0.40], [0.78, 0.62]], [[0.48, 0.40], [0.48, 0.62]]
  ] },
  bread: { halo: [0.76, 0.28], segs: [
    [[0.24, 0.62], [0.26, 0.50], [0.34, 0.42], [0.50, 0.38], [0.66, 0.42], [0.74, 0.50], [0.76, 0.62]],
    [[0.24, 0.62], [0.76, 0.62]], [[0.18, 0.68], [0.82, 0.68]],
    [[0.36, 0.46], [0.42, 0.52]], [[0.46, 0.42], [0.52, 0.48]], [[0.56, 0.42], [0.62, 0.48]]
  ] },
  staff: { halo: [0.28, 0.35], segs: [
    [[0.55, 0.31], [0.55, 0.80]], [[0.59, 0.31], [0.59, 0.80]],
    [[0.55, 0.31], [0.54, 0.22], [0.48, 0.17], [0.42, 0.18], [0.38, 0.24], [0.40, 0.30]],
    [[0.59, 0.31], [0.57, 0.19], [0.48, 0.13], [0.39, 0.16], [0.345, 0.25], [0.375, 0.32]]
  ] },
  wheat: { halo: [0.76, 0.24], segs: [
    [[0.5, 0.26], [0.5, 0.78]],
    [[0.5, 0.34], [0.42, 0.28]], [[0.5, 0.34], [0.58, 0.28]],
    [[0.5, 0.44], [0.40, 0.37]], [[0.5, 0.44], [0.60, 0.37]],
    [[0.5, 0.54], [0.40, 0.47]], [[0.5, 0.54], [0.60, 0.47]],
    [[0.5, 0.64], [0.41, 0.57]], [[0.5, 0.64], [0.59, 0.57]]
  ] }
};

const POOL = ["waves", "arcs", "peaks", "rays", "star", "lattice", "crown", "dove", "anchor", "harp", "candle", "wheat", "mountains", "fish", "book", "staff"];
const motifFor = (text, seed) => {
  const t = String(text).toLowerCase();
  if (/shepherd|pasture|\bstaff|\bflock/.test(t)) return "staff";
  if (/cross|calvary|redeem|blood|lamb|savior|saviour|atone/.test(t)) return "cross";
  if (/dove|spirit|peace|comfort|breath|wind/.test(t)) return "dove";
  if (/star|bethlehem|christmas|noel|emmanuel|immanuel/.test(t)) return "star";
  if (/crown|king|reign|throne|majesty/.test(t)) return "crown";
  if (/communion|supper|table|cup|feast/.test(t)) return "chalice";
  if (/bread|manna|feed|hunger/.test(t)) return "bread";
  if (/mountain|zion|\bhill/.test(t)) return "mountains";
  if (/\bfish|ichthus/.test(t)) return "fish";
  if (/scripture|\bword\b|bible|\bbook/.test(t)) return "book";
  if (/light|lamp|candle|shine|flame|fire/.test(t)) return "candle";
  if (/praise|sing|song|music|melody|rejoice/.test(t)) return "harp";
  if (/harvest|wheat|grain|sow|reap|fruit/.test(t)) return "wheat";
  if (/anchor|hope|steadfast|storm/.test(t)) return "anchor";
  if (/river|water|well|sea|rain|stream|fountain/.test(t)) return "waves";
  if (/grace|mercy|amazing/.test(t)) return "arcs";
  if (/holy|glory|adoration/.test(t)) return "peaks";
  if (/vision|morning|rise|dawn/.test(t)) return "rays";
  return POOL[seed % POOL.length];
};

function motifPath(motif, r, w, h, i, n, en, m) {
  let pts = [];
  const y0 = h * (0.10 + 0.84 * i / n);
  const ic = ICONS[motif];
  if (ic) {
    const seg = ic.segs[i % ic.segs.length], S = m * 0.95;
    const dx = (r() - 0.5) * m * 0.03, dy = (r() - 0.5) * m * 0.03;
    pts = seg.map(([px, py]) => [w / 2 + (px - 0.5) * S + dx + (r() - 0.5) * m * 0.012, h * 0.47 + (py - 0.5) * S + dy + (r() - 0.5) * m * 0.012]);
  } else if (motif === "waves") {
    const amp = ((h * 0.02) + r() * h * 0.045) * en, ph = r() * 6.28, fr = (1.2 + r() * 2.2) * en;
    for (let x = 0; x <= 32; x++) pts.push([w * x / 32, y0 + amp * Math.sin(fr * x / 32 * 6.28 + ph)]);
  } else if (motif === "arcs") {
    const cy = h * 1.15, rad = h * 1.05 * (1 - i / n) + h * 0.08;
    for (let x = 0; x <= 32; x++) { const t = -1.35 + 2.7 * x / 32; pts.push([w / 2 + rad * Math.sin(t), cy - rad * Math.cos(t)]); }
  } else if (motif === "peaks") {
    const amp = (h * 0.05 + r() * h * 0.09) * en, ph = r() * 6.28, fr = (2 + r() * 2) * en;
    for (let x = 0; x <= 32; x++) { const t = fr * x / 32 * 6.28 + ph; pts.push([w * x / 32, y0 + amp * (2 * Math.abs(((t / 3.14) % 2) - 1) - 1)]); }
  } else if (motif === "star") {
    // full burst, alternating long/short rays — Bethlehem star
    const cx = w * 0.5, cy = h * 0.45, ang = i / n * 6.28 + r() * 0.1;
    const len = i % 2 ? m * (0.10 + r() * 0.06) : m * (0.28 + r() * 0.16);
    pts.push([cx + m * 0.03 * Math.cos(ang), cy + m * 0.03 * Math.sin(ang)], [cx + len * Math.cos(ang), cy + len * Math.sin(ang)]);
  } else if (motif === "lattice") {
    // diagonal crosshatch — embossed hymnal cover
    const o = (i / n) * (w + h) * 1.1 - h * 0.05;
    if (i % 2) pts.push([o, 0], [o - h, h]); else pts.push([o - h, 0], [o, h]);
  } else { // rays
    const cx = w * 0.5, cy = h * 0.88, ang = -3.14 + 3.14 * i / n, len = h * (0.55 + r() * 0.5);
    pts.push([cx, cy], [cx + len * Math.cos(ang), cy + len * Math.sin(ang)]);
  }
  return "M" + pts.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" L");
}

export function coverSvg(song, w, h) {
  const seed = hash(song.id || song.title || "wc");
  const r = rng(seed);
  const k = colorway(song.songKey, r());
  const n = 14 + (seed % 3) * 8;
  const m = Math.min(w, h);
  const motif = motifFor((song.title || "") + " " + (song.themes || ""), seed);
  const en = Math.min(1.45, Math.max(0.6, (song.bpm || 88) / 88));
  let lines = "";
  const ic = ICONS[motif];
  if (ic?.fill) {
    const S = m * 0.95, tx = (w - S) / 2, ty = h * 0.47 - S / 2;
    lines = ic.fill.map(d => `<path d="${d}" transform="translate(${tx.toFixed(1)},${ty.toFixed(1)}) scale(${(S / 100).toFixed(3)})" fill="${k.ink}" opacity="0.82"/>`).join("");
  } else {
    for (let i = 0; i < n; i++) {
      lines += `<path d="${motifPath(motif, r, w, h, i, n, en, m)}" fill="none" stroke="${k.ink}" stroke-width="${(0.7 + 0.9 * i / n).toFixed(2)}" opacity="${(0.16 + 0.4 * i / n).toFixed(2)}"/>`;
    }
  }
  let halo = "";
  if (motif !== "star") {
    const sx = (ic ? w / 2 + (ic.halo[0] - 0.5) * m * 0.95 : w * (0.25 + r() * 0.5)).toFixed(0);
    const sy = (ic ? h * 0.47 + (ic.halo[1] - 0.5) * m * 0.95 : h * (0.16 + r() * 0.26)).toFixed(0);
    const r1 = m * (ic ? 0.09 + r() * 0.04 : 0.09 + r() * 0.09);
    halo = `<circle cx="${sx}" cy="${sy}" r="${r1.toFixed(0)}" fill="none" stroke="${GOLD}" stroke-width="${(m * 0.012).toFixed(1)}" opacity="0.85"/>` +
      `<circle cx="${sx}" cy="${sy}" r="${(m * 0.018).toFixed(1)}" fill="${GOLD}" opacity="0.85"/>` +
      (r() > 0.5 ? `<circle cx="${sx}" cy="${sy}" r="${(r1 * 1.45).toFixed(0)}" fill="none" stroke="${GOLD}" stroke-width="${(m * 0.006).toFixed(1)}" opacity="0.55"/>` : "");
  } else {
    halo = `<circle cx="${(w * 0.5).toFixed(0)}" cy="${(h * 0.45).toFixed(0)}" r="${(m * 0.05).toFixed(1)}" fill="none" stroke="${GOLD}" stroke-width="${(m * 0.012).toFixed(1)}" opacity="0.9"/>`;
  }
  const f1 = (m * 0.035).toFixed(1);
  const frame = `<rect x="${f1}" y="${f1}" width="${(w - f1 * 2).toFixed(1)}" height="${(h - f1 * 2).toFixed(1)}" fill="none" stroke="${k.ink}" stroke-width="1" opacity="0.5"/>` +
    (seed % 2 ? `<rect x="${(m * 0.06).toFixed(1)}" y="${(m * 0.06).toFixed(1)}" width="${(w - m * 0.12).toFixed(1)}" height="${(h - m * 0.12).toFixed(1)}" fill="none" stroke="${k.ink}" stroke-width="0.6" opacity="0.35"/>` : "");
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">` +
    `<rect width="${w}" height="${h}" fill="${k.paper}"/>${lines}${halo}${frame}</svg>`;
}
