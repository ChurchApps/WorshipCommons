import type { Confidence } from "../songs";

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  "sunday-ready": "Sunday-ready",
  "score": "Score",
  "generated-from-midi": "Generated from MIDI",
  "chart-only": "Chart only",
  "lyrics-only": "Lyrics only"
};

export const CONFIDENCE_HELP: Record<Confidence, string> = {
  "sunday-ready": "Score, listened-to audio, chart, slides, and rights that agree",
  "score": "Melody score from a written source or Open Hymnal ABC",
  "generated-from-midi": "Score derived from a MIDI file; check it before you print",
  "chart-only": "Lyrics with chords; no melody score yet",
  "lyrics-only": "Words only; no chords or score yet"
};

/** Old catalog values collapse onto score. */
export const normalizeConfidence = (c?: string | null): Confidence | undefined => {
  if (!c) return undefined;
  if (c === "proofread-score" || c === "converted-from-abc") return "score";
  return c as Confidence;
};
