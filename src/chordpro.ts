// ported verbatim from the mockup's transpose logic (mockup/song.html)
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
