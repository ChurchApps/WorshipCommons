import { wcGet } from "./api";

export interface Song {
  id: string;
  title: string;
  writer: string;
  year: number;
  themes: string;
  songKey: string;
  bpm: number;
  timeSignature: string;
  language: string;
  scripture: string;
  scriptureText?: string;
  license: "WC" | "PD";
  churchCount: number;
  chordPro?: string;
  demoAudioUrl?: string;
  demoAudioBytes?: number;
  sheetPdfUrl?: string;
  sheetPdfBytes?: number;
  stemsZipUrl?: string;
  stemsZipBytes?: number;
  midiUrl?: string;
  midiBytes?: number;
  lyricsUrl?: string;
  parentSongId?: string;
  relationLabel?: string;
  proAnswer?: string;
  qualityScore?: number;
  qualityDetail?: string;
}

let cache: Song[] | null = null;
const songCache = new Map<string, Song | null>();

// list payload is summaries only — no chordPro/scriptureText; use loadSong for the full record
export async function loadSongs(): Promise<Song[]> {
  if (!cache) cache = await wcGet("/songs") as Song[];
  return cache;
}

export async function loadSong(id: string): Promise<Song | null> {
  if (!songCache.has(id)) {
    try {
      songCache.set(id, await wcGet(`/songs/${id}`) as Song);
    } catch {
      songCache.set(id, null);
    }
  }
  return songCache.get(id) ?? null;
}

export const themeList = (song: Song) => (song.themes || "").split(",").map(t => t.trim()).filter(Boolean);

export const formatBytes = (bytes?: number) => {
  if (!bytes) return "";
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1).replace(/\.0$/, "") + " MB";
  return Math.max(1, Math.round(bytes / 1024)) + " KB";
};
