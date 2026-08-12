import { MidiNote } from "./midiPlayer";
import { splitKey, noteIndex, SHARP, FLAT } from "./chordpro";

// MIDI → rough ABC skeleton for the transcribe page. Deliberately dumb: melody
// voice only, sixteenth grid, no tuplets/anacrusis/beaming — the contributor
// fixes the draft in the textarea.

const NAT_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const LETTERS = Object.keys(NAT_PC);
const SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"];
const FLAT_ORDER = ["B", "E", "A", "D", "G", "C", "F"];
const KEY_SIGS: Record<string, number> = { C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, "F#": 6, "C#": 7, F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6, Cb: -7 };

// sharps (+) or flats (-) in the key signature; minor keys via relative major
function keySig(key: string): number {
  const { root, suffix } = splitKey(key);
  const major = /^m(?!aj)/.test(suffix)
    ? (root.includes("b") ? FLAT : SHARP)[(noteIndex(root) + 3) % 12]
    : root;
  return KEY_SIGS[major] ?? 0;
}

// duration in sixteenths → ABC duration suffix relative to L:1/8
const durStr = (s: number) => s % 2 === 0 ? (s === 2 ? "" : String(s / 2)) : (s === 1 ? "/" : `${s}/2`);

function pitchStr(letter: string, octave: number) {
  return octave >= 5 ? letter.toLowerCase() + "'".repeat(octave - 5) : letter + ",".repeat(Math.max(0, 4 - octave));
}

export function draftAbc(
  midi: { notes: MidiNote[]; tpb: number },
  song: { title?: string; songKey?: string; bpm?: number; timeSignature?: string }
): string {
  const sig = keySig(song.songKey || "C");
  const keyAcc: Record<string, number> = { C: 0, D: 0, E: 0, F: 0, G: 0, A: 0, B: 0 };
  if (sig > 0) SHARP_ORDER.slice(0, sig).forEach(L => { keyAcc[L] = 1; });
  if (sig < 0) FLAT_ORDER.slice(0, -sig).forEach(L => { keyAcc[L] = -1; });

  // pitch-class → spelling: in-key letters first, then naturals, then chromatic
  const spell: { letter: string; acc: number }[] = [];
  for (let pc = 0; pc < 12; pc++) {
    const inKey = LETTERS.find(L => (NAT_PC[L] + keyAcc[L] + 12) % 12 === pc);
    const natural = LETTERS.find(L => NAT_PC[L] === pc);
    spell[pc] = inKey ? { letter: inKey, acc: keyAcc[inKey] }
      : natural ? { letter: natural, acc: 0 }
        : sig < 0
          ? { letter: LETTERS.find(L => (NAT_PC[L] + 11) % 12 === pc)!, acc: -1 }
          : { letter: LETTERS.find(L => (NAT_PC[L] + 1) % 12 === pc)!, acc: 1 };
  }

  // melody = part 0 (parseMidi ranks parts by mean pitch), quantized to sixteenths
  const grid = midi.tpb / 4;
  const ev: { q: number; dur: number; n: number }[] = [];
  for (const n of midi.notes) {
    if (n.p !== 0) continue;
    const q = Math.round(n.tk / grid);
    const prev = ev[ev.length - 1];
    if (prev && prev.q === q) { if (n.n > prev.n) prev.n = n.n; continue; } // chord in melody track → keep top note
    ev.push({ q, dur: Math.max(1, Math.round(n.dt / grid)), n: n.n });
  }
  for (let i = 0; i < ev.length - 1; i++) ev[i].dur = Math.min(ev[i].dur, Math.max(1, ev[i + 1].q - ev[i].q)); // clip overlaps

  const [num, den] = (song.timeSignature || "4/4").split("/").map(Number);
  const barLen = Math.max(1, Math.round(num * 16 / (den || 4))); // sixteenths per bar

  // ponytail: accidental state tracked per letter (not per octave) — fine for a draft
  let accState = { ...keyAcc };
  const toks: string[] = [];
  let cursor = 0;
  const advance = (len: number, render: (seg: number, tied: boolean) => string) => {
    while (len > 0) {
      const seg = Math.min(len, barLen - (cursor % barLen));
      len -= seg;
      toks.push(render(seg, len > 0));
      cursor += seg;
      if (cursor % barLen === 0) { toks.push("|"); accState = { ...keyAcc }; }
    }
  };

  for (const e of ev) {
    if (e.q > cursor) advance(e.q - cursor, seg => "z" + durStr(seg));
    else if (e.q < cursor) continue;
    const { letter, acc } = spell[((e.n % 12) + 12) % 12];
    const octave = Math.floor((e.n - acc - NAT_PC[letter]) / 12) - 1;
    const pitch = pitchStr(letter, octave);
    advance(e.dur, (seg, tied) => {
      const prefix = accState[letter] === acc ? "" : (acc === 1 ? "^" : acc === -1 ? "_" : "=");
      accState[letter] = acc;
      return prefix + pitch + durStr(seg) + (tied ? "-" : "");
    });
  }

  const lines: string[] = [];
  let cur: string[] = [], bars = 0;
  for (const t of toks) {
    cur.push(t);
    if (t === "|" && ++bars % 4 === 0) { lines.push(cur.join(" ")); cur = []; }
  }
  if (cur.length) lines.push(cur.join(" "));

  return [
    "X:1",
    `T:${song.title || "Untitled"}`,
    `M:${song.timeSignature || "4/4"}`,
    "L:1/8",
    song.bpm ? `Q:1/4=${song.bpm}` : "",
    `K:${song.songKey || "C"}`,
    ...lines
  ].filter(Boolean).join("\n") + "\n";
}
