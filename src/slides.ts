import { parseChordPro, type Stanza } from "./chordpro.ts";
import type { Song } from "./songs";

export interface Slide { label: string; lines: string[]; }
export interface Deck { title: string; slides: Slide[]; }

const plain = (segs: { text: string }[]) => segs.map(s => s.text).join("").replace(/\s+/g, " ").trim();

/** Stanzas in singing order: the `order` picked, else the form map's default order, else the chart as written. */
export function sectionsFor(song: Pick<Song, "chordPro" | "form">, order?: string[]): Stanza[] {
  const stanzas = parseChordPro(song.chordPro || "");
  const byLabel = new Map(stanzas.map(s => [s.label.toLowerCase(), s]));
  const wanted = order || song.form?.defaultOrder;
  const picked = wanted?.length ? wanted.map(l => byLabel.get(l.toLowerCase())).filter((s): s is Stanza => !!s) : [];
  return picked.length ? picked : stanzas;
}

/**
 * The one slide model every projector and export reads, so the web projector and the FreeShow / OpenLP
 * files never disagree: the picked sections, chords stripped, one slide per stanza.
 */
export function slidesFor(song: Pick<Song, "title" | "chordPro" | "form">, order?: string[]): Deck {
  return { title: song.title, slides: sectionsFor(song, order).map(st => ({ label: st.label, lines: st.lines.map(plain).filter(Boolean) })) };
}
