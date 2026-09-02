import { noteIndex } from "../chordpro";

// chord tables in plain notation strings — "name:value" pairs split on whitespace
function table<T>(src: string, parse: (v: string) => T): Record<string, T> {
  return Object.fromEntries(src.trim().split(/\s+/).map(e => { const i = e.lastIndexOf(":"); return [e.slice(0, i), parse(e.slice(i + 1))]; }));
}

// ponytail: qualities beyond this table fall back to the nearest base (7 / m / major) — extend when a chart needs it
const INTERVALS = table("maj:0,4,7 m:0,3,7 7:0,4,7,10 m7:0,3,7,10 maj7:0,4,7,11 sus4:0,5,7 sus2:0,2,7 dim:0,3,6 dim7:0,3,6,9 aug:0,4,8 6:0,4,7,9 m6:0,3,7,9 add9:0,4,7,14 madd9:0,3,7,14 9:0,4,7,10,14 m9:0,3,7,10,14 m7b5:0,3,6,10 5:0,7", v => v.split(",").map(Number));

const ALIAS: Record<string, string> = { "": "maj", M: "maj", min: "m", "-": "m", M7: "maj7", Maj7: "maj7", sus: "sus4", "+": "aug", o: "dim", "2": "sus2", "4": "sus4" };

export const parseChord = (chord: string) => {
  const m = chord.match(/^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/);
  if (!m) return null;
  const raw = m[2].replace(/[()]/g, "");
  return { root: m[1], quality: ALIAS[raw] ?? raw, bass: m[3] };
};

const baseQuality = (q: string) => (q in INTERVALS ? q : q.startsWith("maj7") ? "maj7" : q.startsWith("m7") ? "m7" : q.startsWith("m") ? "m" : q.includes("7") || q.includes("9") ? "7" : "maj");
const label = (q: string) => (q === "maj" ? "" : q);

// frets low E → high e; x = muted. Open shapes first, then barre forms derived from the E and A shapes.
const frets = (v: string) => [...v].map(c => (c === "x" ? -1 : Number(c)));
const OPEN = table(`
  C:x32010 D:xx0232 E:022100 G:320003 A:x02220 Am:x02210 Dm:xx0231 Em:022000
  A7:x02020 B7:x21202 C7:x32310 D7:xx0212 E7:020100 G7:320001 Am7:x02010 Dm7:xx0211 Em7:020000
  Cmaj7:x32000 Dmaj7:xx0222 Amaj7:x02120 Fmaj7:xx3210 Gmaj7:320002 Emaj7:021100
  Asus4:x02230 Dsus4:xx0233 Esus4:022200 Gsus4:330013 Asus2:x02200 Dsus2:xx0230 Csus2:x30010
  Cadd9:x32030 Gadd9:320203 Eadd9:022102
  D/F#:2x0232 G/B:x20003 C/E:032010 C/G:332010 D/A:x00232 Am/G:302210 G/D:xx0003 Em/B:x22000
`, frets);
const E_FORM = table("maj:022100 m:022000 7:020100 m7:020000 maj7:021100 sus4:022200", frets);
const A_FORM = table("maj:x02220 m:x02210 7:x02020 m7:x02010 maj7:x02120 sus4:x02230 sus2:x02200", frets);

export const guitarShape = (chord: string): number[] | null => {
  const p = parseChord(chord);
  if (!p) return null;
  const open = OPEN[chord] || OPEN[p.root + label(p.quality)] || OPEN[p.root + label(baseQuality(p.quality))];
  if (open) return open;
  const q = baseQuality(p.quality);
  const eFret = (noteIndex(p.root) - noteIndex("E") + 12) % 12;
  const aFret = (noteIndex(p.root) - noteIndex("A") + 12) % 12;
  const pick = (form: Record<string, number[]>, f: number) => (form[q] || form.maj).map(n => (n < 0 ? -1 : n + f));
  return aFret > 0 && aFret <= eFret ? pick(A_FORM, aFret) : pick(E_FORM, eFret || 12);
};

export const pianoKeys = (chord: string): number[] => {
  const p = parseChord(chord);
  if (!p) return [];
  const root = noteIndex(p.root);
  const iv = INTERVALS[p.quality] || INTERVALS[baseQuality(p.quality)];
  return iv.map(i => root + i);
};

const BLACK = new Set([1, 3, 6, 8, 10]);

export function Guitar({ chord }: { chord: string }) {
  const frets = guitarShape(chord);
  if (!frets) return null;
  const fretted = frets.filter(f => f > 0);
  const base = Math.max(...fretted, 0) > 4 ? Math.min(...fretted) : 1;
  const W = 60, H = 72, x0 = 10, y0 = 14, sx = (W - 20) / 5, sy = (H - y0 - 6) / 4;
  return (
    <svg className="cd-guitar" width={W + 14} height={H} viewBox={`-14 0 ${W + 14} ${H}`} aria-label={chord}>
      {base > 1 && <text x={-12} y={y0 + sy * 0.7} fontSize="9" fill="currentColor">{base}</text>}
      {base === 1 && <rect x={x0 - 1} y={y0 - 3} width={sx * 5 + 2} height={3} fill="currentColor" />}
      {[0, 1, 2, 3, 4].map(i => <line key={"f" + i} x1={x0} x2={x0 + sx * 5} y1={y0 + sy * i} y2={y0 + sy * i} stroke="currentColor" strokeWidth="1" />)}
      {frets.map((f, i) => (
        <g key={i}>
          <line x1={x0 + sx * i} x2={x0 + sx * i} y1={y0} y2={y0 + sy * 4} stroke="currentColor" strokeWidth="1" />
          {f < 0 && <text x={x0 + sx * i} y={y0 - 5} fontSize="8" textAnchor="middle" fill="currentColor">×</text>}
          {f === 0 && <circle cx={x0 + sx * i} cy={y0 - 7} r="2.5" fill="none" stroke="currentColor" />}
          {f > 0 && <circle className="cd-dot" cx={x0 + sx * i} cy={y0 + sy * (f - base + 0.5)} r="3.6" fill="currentColor" />}
        </g>
      ))}
    </svg>
  );
}

export function Piano({ chord }: { chord: string }) {
  const on = new Set(pianoKeys(chord));
  if (!on.size) return null;
  const whites: number[] = [];
  for (let n = 0; n < 24; n++) if (!BLACK.has(n % 12)) whites.push(n);
  const w = 11, h = 40;
  const whiteX = (n: number) => whites.indexOf(n) * w;
  return (
    <svg className="cd-piano" width={whites.length * w + 1} height={h + 1} aria-label={chord}>
      {whites.map(n => <rect key={n} className={"pk" + (on.has(n) ? " on" : "")} x={whiteX(n) + 0.5} y={0.5} width={w} height={h} fill={on.has(n) ? "var(--primary)" : "#fff"} stroke="currentColor" strokeWidth="1" />)}
      {Array.from({ length: 24 }, (_, n) => n).filter(n => BLACK.has(n % 12)).map(n => (
        <rect key={n} className={"pk black" + (on.has(n) ? " on" : "")} x={whiteX(n - 1) + w * 0.65} y={0.5} width={w * 0.7} height={h * 0.62} fill={on.has(n) ? "var(--primary)" : "#222"} stroke="currentColor" strokeWidth="1" />
      ))}
    </svg>
  );
}

export default function ChordDiagram({ guitar, piano }: { guitar: string; piano: string }) {
  return (
    <span className="chord-pop" data-testid="chord-pop" role="tooltip">
      <span className="cd-col"><b>{guitar}</b><Guitar chord={guitar} /><small>guitar</small></span>
      <span className="cd-col"><b>{piano}</b><Piano chord={piano} /><small>piano</small></span>
    </span>
  );
}
