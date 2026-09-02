// Text-level helpers for the Open Hymnal ABC corpus: multi-voice scores with
// V: decls in the header, [V: id] body lines, and w: lyric lines under the melody.

const PART_NAMES: Record<number, string[]> = {
  2: ["Treble", "Bass"],
  3: ["Soprano", "Tenor", "Bass"],
  4: ["Soprano", "Alto", "Tenor", "Bass"]
};

// OH voices are ordered high to low, same convention as midiPlayer's track ranking
export const partName = (i: number, total: number) => PART_NAMES[total]?.[i] || `Part ${i + 1}`;

export const abcTitle = (abc: string) => abc.match(/^T:\s*(.+)$/m)?.[1].trim() || "";

// the engraved key is ground truth — catalog songKey occasionally disagrees with the OH setting
export const abcKeyRoot = (abc: string) => abc.match(/^K:\s*([A-G][#b]?)/m)?.[1] || "";

export function abcVoices(abc: string): string[] {
  const ids: string[] = [];
  for (const m of abc.matchAll(/^V:\s*(\S+)/gm)) if (!ids.includes(m[1])) ids.push(m[1]);
  return ids;
}

// OH tunes are shared across hymns; when the score's title isn't this song's,
// its w: lyrics belong to a different text and must not be shown
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
export const titlesMatch = (a: string, b: string) => {
  const x = norm(a), y = norm(b);
  return !!x && !!y && (x.includes(y) || y.includes(x));
};

export const stripLyrics = (abc: string) => abc.split(/\r?\n/).filter(l => !/^w:/.test(l)).join("\n");

// Reduce the score to one voice. Clef inherits from the nearest earlier V: decl —
// OH declares the clef only on each staff's first voice.
export function soloVoice(abc: string, voice: string): string {
  const out: string[] = [];
  let clef = "";
  let current = "";
  for (const line of abc.split(/\r?\n/)) {
    const decl = line.match(/^V:\s*(\S+)\s*(.*)$/);
    if (decl) {
      const c = decl[2].match(/clef=\S+/);
      if (c) clef = c[0];
      if (decl[1] === voice) out.push(c || !clef ? line : `V: ${voice} ${clef}`);
      continue;
    }
    if (/^%%staves/.test(line)) continue;
    const inline = line.match(/^\[V:\s*(\S+?)\]/);
    if (inline) {
      current = inline[1];
      if (current === voice) out.push(line);
      continue;
    }
    if (/^w:/.test(line)) {
      if (current === voice) out.push(line);
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}

// Compact melody for the song page: drop title, credits, notes, and free-text verses; keep the first w: verse only.
export function melodyOnly(abc: string): string {
  const out: string[] = [];
  let prevW = false;
  for (const line of abc.split(/\r?\n/)) {
    if (/^[TCWSHNZOBDFGR]:/.test(line)) { prevW = false; continue; }
    if (/^w:/.test(line)) { if (prevW) continue; prevW = true; } else prevW = false;
    out.push(line);
  }
  return out.join("\n");
}
