import { useEffect, useState } from "react";
import { FLAT, FLAT_KEYS, KEY_CHOICES, SHARP, noteIndex, parseChordPro, splitKey, transposeChord, type Stanza } from "./chordpro";
import { licenseNotice } from "./licenses";
import { slidesFor } from "./slides";
import type { Song } from "./songs";

// ponytail: URL-carried setlists — move to /commons/setlists when cross-device sync matters.
// A setlist stores its own key, capo, section picks, and arrangement per song and always reads the
// current package (no pinning): a correction flowing through is a correction, not a surprise.

export interface SetlistItem {
  songId: string;
  key: string;
  capo: number;
  /** section labels from the form map / stanza labels, in singing order; undefined = the song's default order */
  order?: string[];
  arrangement?: string;
  note?: string;
}

export interface Setlist {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  items: SetlistItem[];
  /** the compiled pack may carry CC BY-SA songs, so the pack itself is share-alike */
  shareAlike?: boolean;
}

const KEY = "wcSetlists";
const EVENT = "wc-setlists";

export const newId = () => Math.random().toString(36).slice(2, 10);
export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "setlist";

export function loadSetlists(): Setlist[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(isSetlist) : [];
  } catch {
    return [];
  }
}

function saveAll(lists: Setlist[]) {
  try { localStorage.setItem(KEY, JSON.stringify(lists)); } catch { /* private mode: the session still works in memory */ }
  window.dispatchEvent(new Event(EVENT));
}

export const getSetlist = (id: string): Setlist | undefined => loadSetlists().find(s => s.id === id);

export function createSetlist(name: string, items: SetlistItem[] = [], extra: Partial<Setlist> = {}): Setlist {
  const now = new Date().toISOString();
  const setlist: Setlist = { ...extra, id: newId(), name: name.trim() || "Untitled setlist", createdAt: now, updatedAt: now, items: items.map(cleanItem) };
  saveAll([setlist, ...loadSetlists()]);
  return setlist;
}

export function updateSetlist(id: string, change: (s: Setlist) => Setlist): Setlist | undefined {
  const lists = loadSetlists();
  const i = lists.findIndex(s => s.id === id);
  if (i < 0) return undefined;
  const next = { ...change(lists[i]), id, updatedAt: new Date().toISOString() };
  lists[i] = next;
  saveAll(lists);
  return next;
}

export function deleteSetlist(id: string) {
  saveAll(loadSetlists().filter(s => s.id !== id));
}

export function duplicateSetlist(id: string): Setlist | undefined {
  const src = getSetlist(id);
  return src ? createSetlist(`${src.name} (copy)`, src.items, { shareAlike: src.shareAlike }) : undefined;
}

export const addToSetlist = (id: string, item: SetlistItem) => updateSetlist(id, s => ({ ...s, items: [...s.items, cleanItem(item)] }));
export const removeFromSetlist = (id: string, songId: string) => updateSetlist(id, s => ({ ...s, items: s.items.filter(i => i.songId !== songId) }));

/** Every setlist in this browser, live: re-renders when any tab or component writes one. */
export function useSetlists(): Setlist[] {
  const [lists, setLists] = useState<Setlist[]>(loadSetlists);
  useEffect(() => {
    const refresh = () => setLists(loadSetlists());
    window.addEventListener(EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener(EVENT, refresh); window.removeEventListener("storage", refresh); };
  }, []);
  return lists;
}

// ---- share links: the whole setlist rides in the URL hash, so a viewer needs no account and no server ----

const b64url = (bytes: Uint8Array) => {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const unb64url = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - s.length % 4) % 4));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
};

export const encodeShare = (setlist: Setlist) => b64url(new TextEncoder().encode(JSON.stringify({ n: setlist.name, sa: setlist.shareAlike || undefined, i: setlist.items.map(cleanItem) })));

export function decodeShare(hash: string): Setlist | null {
  try {
    const raw = JSON.parse(new TextDecoder().decode(unb64url(hash.replace(/^#/, ""))));
    if (!raw || typeof raw.n !== "string" || !Array.isArray(raw.i)) return null;
    const now = new Date().toISOString();
    return { id: "shared", name: raw.n, createdAt: now, updatedAt: now, shareAlike: !!raw.sa, items: raw.i.filter(isItem).map(cleanItem) };
  } catch {
    return null;
  }
}

export const shareUrl = (setlist: Setlist) => `${location.origin}/setlists/shared#${encodeShare(setlist)}`;

// ---- duration ----

const beatsPerBar = (song: Pick<Song, "timeSignature">) => Number((song.timeSignature || "4/4").split("/")[0]) || 4;

/** Seconds for one song: the package sing time, else a rough count from the chart (marked ≈). */
export function songSeconds(song: Song | undefined, order?: string[]): { seconds: number; approx: boolean } {
  if (!song) return { seconds: 0, approx: true };
  if (song.singTimeSeconds) return { seconds: song.singTimeSeconds, approx: false };
  const sections = song.chordPro ? sectionsFor(song, order).length : 0;
  if (!sections || !song.bpm) return { seconds: 0, approx: true };
  // ponytail: a stanza is taken as 4 bars — fine for a total, not for a click track
  return { seconds: Math.round(sections * 4 * beatsPerBar(song) * 60 / song.bpm), approx: true };
}

export function durationSeconds(items: SetlistItem[], songs: Song[]): { seconds: number; approx: boolean } {
  const byId = new Map(songs.map(s => [s.id, s]));
  const total = { seconds: 0, approx: false };
  for (const item of items) {
    const d = songSeconds(byId.get(item.songId), item.order);
    total.seconds += d.seconds;
    total.approx = total.approx || d.approx;
  }
  return total;
}

export const formatMinutes = (seconds: number) => `${Math.max(1, Math.round(seconds / 60))}`;

// ---- charts: one transposition for the chart view, the print booklet, the ChordPro paste, and the pack ----

/** Stanzas in singing order: the `order` picked, else the form map's default order, else the chart as written. */
export function sectionsFor(song: Pick<Song, "chordPro" | "form">, order?: string[]): Stanza[] {
  const stanzas = parseChordPro(song.chordPro || "");
  const byLabel = new Map(stanzas.map(s => [s.label.toLowerCase(), s]));
  const wanted = order || song.form?.defaultOrder;
  const picked = wanted?.length ? wanted.map(l => byLabel.get(l.toLowerCase())).filter((s): s is Stanza => !!s) : [];
  return picked.length ? picked : stanzas;
}

/** Section labels a setlist may pick from: the form map's sections, else the stanza labels. */
export const sectionLabels = (song: Pick<Song, "chordPro" | "form">): string[] => {
  const fromForm = (song.form?.sections || []).map(s => s.label).filter(Boolean);
  return fromForm.length ? fromForm : [...new Set(parseChordPro(song.chordPro || "").map(s => s.label))];
};

export const defaultOrder = (song: Pick<Song, "chordPro" | "form">): string[] => song.form?.defaultOrder?.length ? song.form.defaultOrder : sectionsFor(song).map(s => s.label);

/** How the chords are written once a key and capo are chosen — the same arithmetic as the song page and /print. */
export function chartShapes(song: Pick<Song, "songKey">, key: string, capo: number) {
  const { root: origRoot, suffix } = splitKey(song.songKey);
  const { root: selRoot } = splitKey(key || song.songKey);
  const shift = (noteIndex(selRoot) - noteIndex(origRoot) + 12) % 12;
  const shapeIdx = (noteIndex(selRoot) - capo + 12) % 12;
  const shapeRoot = FLAT_KEYS.has(FLAT[shapeIdx]) ? FLAT[shapeIdx] : SHARP[shapeIdx];
  return { keyLabel: selRoot + suffix, shapeLabel: shapeRoot + suffix, dispShift: (shift - capo + 12) % 12, useFlats: FLAT_KEYS.has(shapeRoot) };
}

export function transposedSections(song: Song, key: string, capo: number, order?: string[]): Stanza[] {
  const { dispShift, useFlats } = chartShapes(song, key, capo);
  return sectionsFor(song, order).map(st => ({ label: st.label, lines: st.lines.map(line => line.map(seg => ({ ...seg, chord: seg.chord ? transposeChord(seg.chord, dispShift, useFlats) : undefined }))) }));
}

/** ChordPro text as OnSong / Planning Center paste it: directives, then the picked sections with chords in the chosen key. */
export function chordProFor(song: Song, key: string, capo: number, order?: string[]): string {
  const { keyLabel } = chartShapes(song, key, capo);
  const head = [`{title: ${song.title}}`, `{artist: ${song.writer}}`, `{key: ${keyLabel}}`];
  if (capo) head.push(`{capo: ${capo}}`);
  if (song.bpm) head.push(`{tempo: ${song.bpm}}`);
  if (song.timeSignature) head.push(`{time: ${song.timeSignature}}`);
  const body = transposedSections(song, key, capo, order).map(st => [st.label, ...st.lines.map(line => line.map(seg => (seg.chord ? `[${seg.chord}]` : "") + seg.text).join(""))].join("\n"));
  return [head.join("\n"), ...body].join("\n\n") + "\n";
}

/** Key choices for the picker: the package's published keys first, every other root as a preview. */
export function keyChoices(song: Pick<Song, "songKey" | "publishedKeys" | "recommendedKey">): { published: string[]; preview: string[] } {
  const { suffix } = splitKey(song.songKey);
  const published = [...new Set((song.publishedKeys?.length ? song.publishedKeys : [song.songKey, song.recommendedKey]).filter(Boolean) as string[])];
  const roots = new Set(published.map(k => noteIndex(splitKey(k).root)));
  return { published, preview: KEY_CHOICES.filter(k => !roots.has(noteIndex(k))).map(k => k + suffix) };
}

export const isShareAlike = (song: Pick<Song, "license">) => /-SA$/.test(song.license || "");

/** Files for one song inside the house-church pack. */
export function packFilesFor(song: Song, item: SetlistItem, prefix: string): { name: string; text: string }[] {
  const deck = slidesFor(song, item.order);
  const { keyLabel } = chartShapes(song, item.key, item.capo);
  return [
    { name: `${prefix}/chart.${keyLabel}.cho`, text: chordProFor(song, item.key, item.capo, item.order) },
    { name: `${prefix}/lyrics.txt`, text: `${song.title}\n\n${deck.slides.map(s => `${s.label}\n${s.lines.join("\n")}`).join("\n\n")}\n` },
    { name: `${prefix}/slides.json`, text: JSON.stringify(deck, null, 2) },
    { name: `${prefix}/attribution.txt`, text: (song.attribution || licenseNotice(song)).trim() + "\n" }
  ];
}

export const licenseLineFor = (song: Song) => `${song.title} — ${song.writer}${song.year ? `, ${song.year}` : ""}\n${licenseNotice(song)}\nhttps://worshipcommons.org/songs/${song.id}`;

// ---- shape guards ----

const isItem = (x: any): x is SetlistItem => !!x && typeof x.songId === "string";
const isSetlist = (x: any): x is Setlist => !!x && typeof x.id === "string" && typeof x.name === "string" && Array.isArray(x.items);
const cleanItem = (i: SetlistItem): SetlistItem => ({
  songId: i.songId,
  key: i.key || "",
  capo: Math.min(11, Math.max(0, Number(i.capo) || 0)),
  ...(Array.isArray(i.order) ? { order: i.order.filter(l => typeof l === "string") } : {}),
  ...(i.arrangement ? { arrangement: String(i.arrangement) } : {}),
  ...(i.note ? { note: String(i.note) } : {})
});
