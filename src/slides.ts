import { parseChordPro } from "./chordpro.ts";
import type { Song } from "./songs";

export interface Slide { label: string; lines: string[]; }
export interface Deck { title: string; slides: Slide[]; }

const plain = (segs: { text: string }[]) => segs.map(s => s.text).join("").replace(/\s+/g, " ").trim();

/**
 * The one slide model every projector and export reads, so the web projector and the FreeShow / OpenLP
 * files never disagree. Sections come from the ChordPro stanzas; the order from the package form map
 * (defaultOrder names stanza labels) or the `order` a setlist chose, else the stanzas as written.
 */
export function slidesFor(song: Pick<Song, "title" | "chordPro" | "form">, order?: string[]): Deck {
  const stanzas: Slide[] = parseChordPro(song.chordPro || "").map(st => ({ label: st.label, lines: st.lines.map(plain).filter(Boolean) }));
  const byLabel = new Map(stanzas.map(s => [s.label.toLowerCase(), s]));
  const wanted = order || song.form?.defaultOrder;
  const picked = wanted?.length ? wanted.map(l => byLabel.get(l.toLowerCase())).filter((s): s is Slide => !!s) : [];
  return { title: song.title, slides: picked.length ? picked : stanzas };
}
