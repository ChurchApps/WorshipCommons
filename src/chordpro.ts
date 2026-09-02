export const SHARP = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"
];
export const FLAT = [
  "C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"
];
export const FLAT_KEYS = new Set(["F", "Bb", "Eb", "Ab", "Db"]);
export const KEY_CHOICES = [
  "C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"
];

export const noteIndex = (n: string) => { const i = SHARP.indexOf(n); return i >= 0 ? i : FLAT.indexOf(n); };

export const splitKey = (key: string) => {
  const m = (key || "C").match(/^([A-G][#b]?)(.*)$/);
  return { root: m ? m[1] : "C", suffix: m ? m[2] : "" };
};

export const transposeChord = (chord: string, shift: number, useFlats: boolean) => {
  const m = chord.match(/^([A-G][#b]?)(.*)$/);
  if (!m) return chord;
  const scale = useFlats ? FLAT : SHARP;
  return scale[(noteIndex(m[1]) + shift + 12) % 12] + m[2];
};

export interface Segment { chord?: string; text: string; }
export interface Stanza { label: string; lines: Segment[][]; }

// chordPro: stanzas separated by blank lines, first line = label, chords inline as [D]
export function parseChordPro(chordPro: string): Stanza[] {
  const stanzas: Stanza[] = [];
  for (const block of (chordPro || "").split(/\r?\n\s*\r?\n/)) {
    const lines = block.split(/\r?\n/).filter(l => l.trim() !== "");
    if (lines.length === 0) continue;
    const stanza: Stanza = { label: lines[0].trim(), lines: [] };
    for (const line of lines.slice(1)) {
      const parts = line.split(/\[([^\]]+)\]/);
      const segments: Segment[] = [];
      if (parts[0]) segments.push({ text: parts[0] });
      for (let i = 1; i < parts.length; i += 2) segments.push({ chord: parts[i], text: parts[i + 1] || "" });
      stanza.lines.push(segments);
    }
    stanzas.push(stanza);
  }
  return stanzas;
}

// Nashville numbers: chord root → scale degree of the original key (flats for non-diatonic roots); invariant under transpose and capo.
// ponytail: degrees are always major-scale relative to the tonic — a minor key reads 1m, b3, 4m, 5m, b6, b7, which is how most Nashville charts write minor
const DEGREES = [
  "1", "b2", "2", "b3", "3", "4", "b5", "5", "b6", "6", "b7", "7"
];
const nashRoot = (note: string, keyRoot: string) => DEGREES[(noteIndex(note) - noteIndex(keyRoot) + 12) % 12];
export const toNashville = (chord: string, keyRoot: string) => {
  const m = chord.match(/^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/);
  if (!m) return chord;
  return nashRoot(m[1], keyRoot) + m[2] + (m[3] ? "/" + nashRoot(m[3], keyRoot) : "");
};

export interface LintIssue { level: "error" | "warn"; line: number; message: string; vars?: Record<string, string>; }

const SECTION_DIRECTIVE = /^\s*\{\s*(verse|chorus|bridge|sov|soc|sob|start_of_\w+)\b/i;
const SECTION_LABEL = /^\s*(verse|chorus|bridge|refrain|pre[- ]?chorus|intro|outro|tag|interlude|ending|coda)\b/i;
const KEY_DIRECTIVE = /^\s*\{\s*k(?:ey)?\s*:\s*([^}]*)\}/i;
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10];

const isMinor = (suffix: string) => /^m(?!aj)/.test(suffix);

// pitch classes of the diatonic triad roots — major scale, or natural minor for an "m" key
const diatonic = (key: string) => {
  const { root, suffix } = splitKey(key);
  const base = noteIndex(root);
  if (base < 0) return null;
  return new Set((isMinor(suffix) ? MINOR_STEPS : MAJOR_STEPS).map(s => (base + s) % 12));
};

const sameKey = (a: string, b: string) => {
  const x = splitKey(a), y = splitKey(b);
  return noteIndex(x.root) === noteIndex(y.root) && isMinor(x.suffix) === isMinor(y.suffix);
};

// Advisory checks for the submit form: bracket damage is an error, everything else is a nudge.
export function lintChordPro(text: string, key?: string): LintIssue[] {
  const issues: LintIssue[] = [];
  const lines = (text || "").split(/\r?\n/);
  const scale = key ? diatonic(key) : null;
  const outside = new Map<string, number>();
  let hasSection = false;

  lines.forEach((line, i) => {
    const n = i + 1;
    let open = false, broken = false;
    for (const ch of line) {
      if (ch === "[") { if (open) { broken = true; break; } open = true; } else if (ch === "]") { if (!open) { broken = true; break; } open = false; }
    }
    if (broken || open) issues.push({ level: "error", line: n, message: "Unmatched bracket — every [ needs a closing ]." });

    if (SECTION_DIRECTIVE.test(line) || SECTION_LABEL.test(line)) hasSection = true;

    const declared = line.match(KEY_DIRECTIVE);
    if (declared && key && declared[1].trim() && !sameKey(declared[1].trim(), key)) {
      issues.push({ level: "warn", line: n, message: "Key directive {declared} disagrees with the song key {key}.", vars: { declared: declared[1].trim(), key } });
    }

    if (!scale) return;
    for (const m of line.matchAll(/\[([^\]]+)\]/g)) {
      const chord = m[1].trim();
      const root = chord.match(/^([A-G][#b]?)/);
      if (!root || scale.has(noteIndex(root[1]))) continue;
      if (!outside.has(chord)) outside.set(chord, n);
    }
  });

  if (!hasSection && lines.length > 8) issues.push({ level: "warn", line: 1, message: "No section labels — start each section with its name (Verse 1, Chorus…)." });

  if (outside.size > 2) {
    issues.push({ level: "warn", line: Math.min(...outside.values()), message: "Chords outside {key}: {chords}", vars: { key: key || "", chords: [...outside.keys()].join(", ") } });
  }

  return issues.sort((a, b) => a.line - b.line);
}
