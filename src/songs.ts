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
  meter?: string;
  language: string;
  scripture: string;
  scriptureText?: string;
  license: "WC" | "PD";
  downloadCount: number;
  likeCount: number;
  chordPro?: string;
  path?: string;
  files?: string;
  fileUrls?: Record<string, string>;
  demoAudioUrl?: string;
  sheetPdfUrl?: string;
  stemsZipUrl?: string;
  midiUrl?: string;
  lyricsUrl?: string;
  abcUrl?: string;
  videoUrl?: string;
  writerPortraitUrl?: string;
  writerBio?: string;
  artUrl?: string;
  parentSongId?: string;
  relationLabel?: string;
  authorId?: string;
  writerId?: string;
  proAnswer?: string;
  qualityScore?: number;
  qualityDetail?: string;
  status?: string;
  createdAt?: string;
  publishedAt?: string;
}

let cache: Song[] | null = null;
const songCache = new Map<string, Song | null>();

// the API ships one fileUrls map (media key → absolute URL); fan it back out to the
// legacy per-file fields so the rest of the site keeps its vocabulary
const URL_FIELDS: [keyof Song, string][] = [
  ["demoAudioUrl", "demoAudio"],
  ["sheetPdfUrl", "sheetPdf"],
  ["stemsZipUrl", "stemsZip"],
  ["midiUrl", "midi"],
  ["abcUrl", "abc"],
  ["lyricsUrl", "timing"],
  ["artUrl", "art"],
  ["writerPortraitUrl", "portrait"]
];

export function songFromApi(raw: any): Song {
  const urls = raw.fileUrls || {};
  for (const [field, key] of URL_FIELDS) if (urls[key]) raw[field] = urls[key];
  return raw as Song;
}

// list payload is summaries only — no chordPro/scriptureText; use loadSong for the full record
export function clearSongCache() {
  cache = null;
  songCache.clear();
}

if (typeof window !== "undefined") window.addEventListener("focus", clearSongCache);

export async function loadSongs(): Promise<Song[]> {
  if (!cache) cache = (await wcGet("/songs") as any[]).map(songFromApi);
  return cache;
}

export async function loadSong(id: string): Promise<Song | null> {
  if (!songCache.has(id)) {
    try {
      songCache.set(id, songFromApi(await wcGet(`/songs/${id}`)));
    } catch {
      songCache.set(id, null);
    }
  }
  return songCache.get(id) ?? null;
}

export const themeList = (song: Song) => (song.themes || "").split(",").map(t => t.trim()).filter(Boolean);

// leading book name of a reference — "1 John 3:16" → "1 John", "Psalm 23" → "Psalm"
export const scriptureBook = (song: Song) => (song.scripture || "").replace(/\s+\d+.*$/, "").trim();

export const songRecency = (s: Song) => {
  const t = Date.parse(s.publishedAt || s.createdAt || "");
  return Number.isNaN(t) ? s.year || 0 : t;
};
