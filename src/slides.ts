import { parseChordPro, unparen, type Stanza } from "./chordpro.ts";
import type { Song } from "./songs";

export interface Slide { label: string; lines: string[]; }
export interface Deck { title: string; slides: Slide[]; }

const plain = (segs: { text: string }[]) => segs.map(s => s.text).join("").replace(/\s+/g, " ").trim();

/** Stanzas in singing order: the `order` picked, else the form map's default order, else the chart as written. */
export function sectionsFor(song: Pick<Song, "chordPro" | "form">, order?: string[]): Stanza[] {
  const stanzas = parseChordPro(song.chordPro || "");
  const byLabel = new Map(stanzas.map(s => [unparen(s.label).toLowerCase(), s]));
  const wanted = order || song.form?.defaultOrder;
  const picked = wanted?.length ? wanted.map(l => byLabel.get(unparen(l).toLowerCase())).filter((s): s is Stanza => !!s) : [];
  return picked.length ? picked : stanzas;
}

/**
 * The one slide model every projector and export reads, so the web projector and the FreeShow / OpenLP
 * files never disagree: the picked sections, chords stripped, one slide per stanza.
 */
// "4x", "x2", "(2x)", "Repeat", "(To the Top)", "D.S. al Coda": a direction for the band, not words for the room
const REPEAT_MARK = /^\(?\s*(?:x\s*\d+|\d+\s*x|repeat\b.*|(?:to|from) the top|d\.\s?[cs]\.(?:\s*al\b.*)?|da capo\b.*|dal segno\b.*|to coda|fine)\s*\)?$/i;
// "The Great I Am (2x)": the mark at the end of a sung line goes, the words stay
const TRAILING_REPEAT = /\s*\((?:x\s*\d+|\d+\s*x)\)\s*$/i;

export function slidesFor(song: Pick<Song, "title" | "chordPro" | "form">, order?: string[]): Deck {
  return { title: song.title, slides: sectionsFor(song, order).map(st => ({ label: st.label, lines: st.lines.map(plain).filter(l => l && !REPEAT_MARK.test(l.trim())).map(l => l.replace(TRAILING_REPEAT, "")) })) };
}
