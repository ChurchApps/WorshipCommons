// What a song package can take in and what each source unlocks (.notes/song-pipeline.md §3 and §5).
// Pure data + two functions: the song page detects what a song has and renders the rest from here.
export type InputId = "words" | "chords" | "abc" | "musicxml" | "tuneMid" | "sheetPdf" | "timing" | "recording" | "recordingGrant" | "video" | "cover" | "extras";

// Both lists are in display order, chosen (by search) so the wires between them travel the least vertical distance.
export const INPUTS: [InputId, string][] = [
  ["words", "Lyrics"],
  ["chords", "Chords (ChordPro)"],
  ["timing", "Word timings"],
  ["recordingGrant", "Recording grant"],
  ["recording", "Recording"],
  ["tuneMid", "Melody MIDI"],
  ["musicxml", "Score (MusicXML)"],
  ["abc", "Score (ABC)"],
  ["sheetPdf", "Sheet music PDF or scan"],
  ["video", "Performance video link"],
  ["cover", "Cover art"],
  ["extras", "Extra files (tabs, parts, tracks)"]
];

export interface Output {
  id: string;
  label: string;
  /** every group must be met; a group is met by any one of its inputs */
  needs: InputId[][];
}

const TUNE: InputId[] = ["abc", "musicxml", "tuneMid"];
// ponytail: the sketch score transcribed from a granted master (spec §5) is not a row — it cannot be told apart from a real score in fileUrls
export const OUTPUTS: Output[] = [
  { id: "lyrics", label: "Lyrics, slides, stage view, print chart", needs: [["words"]] },
  { id: "compositionZip", label: "Composition pack (ZIP)", needs: [["words"]] },
  { id: "chords", label: "Chord chart in any key", needs: [["words"], ["chords"]] },
  { id: "highlight", label: "Word-by-word highlighting", needs: [["words"], ["timing"]] },
  { id: "packs", label: "Audio pack and multitracks", needs: [["recording"], ["recordingGrant"]] },
  { id: "listen", label: "Recording to listen to", needs: [["recording"]] },
  { id: "lead", label: "Lead worship sing-along", needs: [["words"], [...TUNE, "recording"]] },
  { id: "playback", label: "Piano preview and practice parts", needs: [TUNE] },
  { id: "score", label: "Score files (MusicXML, MIDI)", needs: [["abc", "musicxml"]] },
  { id: "sheet", label: "Engraved sheet music, every part", needs: [["abc"]] },
  { id: "sheetPdf", label: "Sheet music PDF, as given", needs: [["sheetPdf"]] },
  { id: "video", label: "Watch a performance", needs: [["video"]] },
  { id: "cover", label: "Cover image and pack album art", needs: [["cover"]] },
  { id: "extras", label: "Extra files, republished as given", needs: [["extras"]] }
];

/** Groups of `output.needs` that nothing in `have` satisfies. Empty → it can be built. */
export const unmet = (output: Output, have: Set<InputId>) => output.needs.filter(group => !group.some(i => have.has(i)));

export const enabledBy = (input: InputId) => OUTPUTS.filter(o => o.needs.some(group => group.includes(input)));

/** One source republished as it came, feeding nothing else: drawn as a straight line on a row of its own. */
export const isPassthrough = (o: Output) => o.needs.length === 1 && o.needs[0].length === 1 && enabledBy(o.needs[0][0]).length === 1;
