import { wcGet } from "./api";
import themeVocabulary from "./themes.json";

// ---- package model: what masters/ and derivatives/ hold, as the API reports it ----
export type Confidence = "sunday-ready" | "proofread-score" | "converted-from-abc" | "generated-from-midi" | "chart-only" | "lyrics-only";
export type RightsLayer = "text" | "translation" | "tune" | "arrangement" | "recording" | "artwork";
export interface RightsRow { license: string; basis?: string | null; source?: string | null; holder?: string | null; note?: string | null; review?: string | null; }
export type Rights = Partial<Record<RightsLayer, RightsRow | null>>;
export type Use = "project" | "print" | "stream" | "arrange" | "record";
export interface UseRule { allowed: boolean; conditions: string[]; }
export type RightsMatrix = Record<Use, UseRule>;
export interface FormSection { label: string; lyric?: number | null; measures?: string | null; }
export interface FormMap { status?: "draft" | "approved"; sections: FormSection[]; defaultOrder: string[]; }
export interface Contributor { name: string; what: string; submissionId?: string; at?: string; }

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
  /** registry id from licenses.json: PD, WC, CC-BY, CC-BY-SA, CC-BY-NC, CC-BY-NC-SA */
  license: string;
  licenseVersion?: string;
  licenseUrl?: string;
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
  /** opaque popularity/quality blend from the API; the moderation quality score stays reviewer-only */
  rank?: number;
  status?: string;
  createdAt?: string;
  publishedAt?: string;
  // package model (summary rows)
  confidence?: Confidence;
  sundayReady?: boolean;
  featured?: boolean;
  firstLine?: string | null;
  tune?: string | null;
  hasChords?: boolean;
  hasScore?: boolean;
  hasSlides?: boolean;
  hasTiming?: boolean;
  hasAccompaniment?: boolean;
  recommendedKey?: string | null;
  singTimeSeconds?: number | null;
  hymnalCount?: number;
  // package model (detail only)
  rights?: Rights | null;
  rightsMatrix?: RightsMatrix | null;
  ccliReport?: boolean | null;
  attribution?: string | null;
  form?: FormMap | null;
  publishedKeys?: string[];
  recommendedKeyReason?: string | null;
  scoreSource?: "master" | "abc" | "midi" | null;
  contributors?: Contributor[];
  sundayReadyAt?: string | null;
  sundayReadyBy?: string | null;
  listenedKeys?: string[];
  scoreUrl?: string;
  slidesUrl?: string;
  chartUrl?: string;
  chartPdfUrl?: string;
  attributionUrl?: string;
  thumbUrl?: string;
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
  ["writerPortraitUrl", "portrait"],
  ["scoreUrl", "score"],
  ["slidesUrl", "slides"],
  ["chartUrl", "chart"],
  ["chartPdfUrl", "chartPdf"],
  ["attributionUrl", "attribution"],
  ["thumbUrl", "thumb"]
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

export interface HistoryEntry { submissionId: string; submittedByName?: string; approvedAt?: string; note?: string; filesChanged?: { name: string; action: string }[] }
export interface SongRating { average: number | null; count: number; mine: number | null; }
export interface SongPageData {
  song: Song;
  rating: SongRating;
  history: HistoryEntry[];
  /** parent + siblings + children via parentSongId, in catalog order */
  family: Song[];
  /** top matches in the same language, each with a one-sentence reason */
  similar: (Song & { reason?: string })[];
}

// The one fetch the song page needs: detail + rating (mine needs the JWT) + history + family + similar.
// Not cached — `rating.mine` depends on who is asking.
export async function loadSongPage(id: string): Promise<SongPageData | null> {
  try {
    const raw = await wcGet(`/songs/${id}/page`, true);
    if (!raw?.song) return null;
    return {
      song: songFromApi(raw.song),
      rating: { average: raw.rating?.average ?? null, count: raw.rating?.count ?? 0, mine: raw.rating?.mine ?? null },
      history: raw.history || [],
      family: (raw.family || []).map(songFromApi),
      similar: (raw.similar || []).map(songFromApi)
    };
  } catch {
    return null;
  }
}

// the controlled vocabulary, in the order it should be offered and faceted
export const THEMES: string[] = themeVocabulary.themes;

// the six the home page leads with — all drawn from THEMES
export const HOME_THEMES = ["Praise", "Advent", "Christmas", "Easter", "Communion", "Comfort"];

export const themeList = (song: Song) => (song.themes || "").split(",").map(t => t.trim()).filter(Boolean);

// leading book name of a reference — "1 John 3:16" → "1 John", "Psalm 23" → "Psalm"
export const scriptureBook = (song: Song) => (song.scripture || "").replace(/\s+\d+.*$/, "").trim();

export const songRecency = (s: Song) => {
  const t = Date.parse(s.publishedAt || s.createdAt || "");
  return Number.isNaN(t) ? s.year || 0 : t;
};
