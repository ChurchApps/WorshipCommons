import type { Confidence } from "../songs";

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  "sunday-ready": "Sunday-ready",
  "proofread-score": "Proofread score",
  "converted-from-abc": "Converted from ABC",
  "generated-from-midi": "Generated from MIDI",
  "chart-only": "Chart only",
  "lyrics-only": "Lyrics only"
};

export const CONFIDENCE_HELP: Record<Confidence, string> = {
  "sunday-ready": "Proofread score, listened-to audio, chart, slides, and rights that agree",
  "proofread-score": "A person proofread the notes; charts and audio are built from them",
  "converted-from-abc": "Score converted from Open Hymnal ABC, not yet proofread here",
  "generated-from-midi": "Score derived from a MIDI file; check it before you print",
  "chart-only": "Lyrics with chords; no melody score yet",
  "lyrics-only": "Words only; no chords or score yet"
};

/** A song whose score is machine-derived must never wear Sunday-ready chrome. */
export const isDerivedScore = (c?: Confidence | null) => c === "converted-from-abc" || c === "generated-from-midi";
