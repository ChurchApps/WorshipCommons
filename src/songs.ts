import { folderSlug } from "./slug.mjs";
export { idOf, songPath, writerPath } from "./slug.mjs";
import { CORE_API, wcGet } from "./api";
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
  ["artUrl", "cover"],
  ["writerPortraitUrl", "portrait"],
  ["scoreUrl", "score"],
  ["slidesUrl", "slides"],
  ["chartUrl", "chart"],
  ["chartPdfUrl", "chartPdf"],
  ["attributionUrl", "attribution"],
  ["thumbUrl", "thumb"]
];

/** First matching key in the API's fileUrls map. */
export function fileUrl(song: Song, ...keys: string[]): string | undefined {
  const u = song.fileUrls || {};
  for (const k of keys) if (u[k]) return u[k];
  return undefined;
}

/** CDN origin + /commons prefix, so shared assets (pads) can be addressed from any song. */
export function contentRootOf(song: Song): string {
  const u = Object.values(song.fileUrls || {}).find(Boolean) || song.midiUrl || song.abcUrl || song.artUrl || "";
  const hit = ["/songs/", "/works/", "/assets/", "/writers/"].map(s => String(u).indexOf(s)).filter(n => n > 0).sort((a, b) => a - b)[0];
  return hit ? String(u).slice(0, hit) : "";
}

const beside = (url: string | undefined, name: string) =>
  url ? url.replace(/\/(sources|masters|derivatives)\/[^/?#]+$/, `/derivatives/${name}`) : undefined;

/**
 * Kit files live in derivatives/ but the API's fileUrls map does not list them yet.
 * Build the URL next to the tune (work/song midi or abc) or the song chart.
 */
export function kitFile(song: Song, name: string, from: "tune" | "song" = "song"): string | undefined {
  const mapped = fileUrl(song, name, name.replace(/-([a-z])/g, (_, c) => c.toUpperCase()), name.replace(/\.pdf$/, "Pdf").replace(/-([a-zA-Z])/g, (_, c) => c.toUpperCase()));
  if (mapped) return mapped;
  if (from === "tune") return beside(song.fileUrls?.abc || song.abcUrl || song.fileUrls?.midi || song.midiUrl, name);
  return beside(song.fileUrls?.chartPdf || song.chartPdfUrl || song.fileUrls?.chart || song.fileUrls?.slides, name);
}

const LANG_CODE: Record<string, string> = {
  English: "en",
  Spanish: "es",
  German: "de",
  French: "fr",
  Portuguese: "pt",
  Russian: "ru",
  Hungarian: "hu",
  Albanian: "sq",
  Malayalam: "ml",
  Latin: "la",
  Zulu: "zu"
};
const licenseSection = (id: string) => id === "PD" ? "public-domain" : id === "WC" ? "wc-license" : id.toLowerCase();

export function contentPrefix(song: Song): string {
  return contentRootOf(song) || `${CORE_API.replace(/\/$/, "")}/content/commons`;
}

/** songs/<lang>/<section>/<slug>-<id> as the content bucket lays it out. */
export function packageDir(song: Song): string | undefined {
  const fromUrl = Object.values(song.fileUrls || {}).concat(song.midiUrl || "", song.abcUrl || "").find(u => /\/songs\//.test(String(u)));
  const hit = String(fromUrl || "").match(/\/(songs\/.+?)\/(?:sources|masters|derivatives)\//);
  if (hit) return hit[1];
  const lang = LANG_CODE[song.language] || String(song.language || "en").slice(0, 2).toLowerCase();
  if (!song.id) return;
  return `songs/${lang}/${licenseSection(song.license || "PD")}/${folderSlug(song.title)}-${song.id}`;
}

export function packageFile(song: Song, rel: string): string | undefined {
  const dir = packageDir(song);
  return dir ? `${contentPrefix(song)}/${dir}/${rel}` : undefined;
}

/**
 * MIDI + word-timing for Lead worship. The API's fileUrls map often omits both
 * after the package-layout cutover; the files still live at the package/work paths.
 */
export function leadFiles(song: Song): { midi: string[]; timing?: string } {
  const root = contentPrefix(song);
  const slug = folderSlug(song.title);
  const midi = [
    song.midiUrl,
    fileUrl(song, "midi"),
    packageFile(song, "sources/tune.mid"),
    `${root}/works/${slug}/sources/tune.mid`
  ].filter((u, i, a): u is string => !!u && a.indexOf(u) === i);
  const timing = song.lyricsUrl || fileUrl(song, "timing") || packageFile(song, "derivatives/timing.json");
  return { midi, timing };
}

const listed = (song: Song, url?: string) =>
  !!url && (url === song.midiUrl || url === song.lyricsUrl || url === fileUrl(song, "midi") || url === fileUrl(song, "timing"));

async function urlOk(song: Song, url?: string) {
  if (!url) return false;
  if (listed(song, url)) return true;
  try { return (await fetch(url, { method: "HEAD" })).ok; } catch { return false; }
}

/** Confirm MIDI/timing exist (API listings skip them; the files are still on the content bucket). */
export async function resolveLead(song: Song): Promise<{ midi?: string; timing?: string }> {
  const files = leadFiles(song);
  let midi: string | undefined;
  for (const u of files.midi) if (await urlOk(song, u)) { midi = u; break; }
  const timing = (await urlOk(song, files.timing)) ? files.timing : undefined;
  return { midi, timing };
}

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

// ponytail: "Hymn" for the public-domain hymnal, "Song" for everything a living writer shared
export const kindOf = (song: Song) => (song.license === "PD" ? "Hymn" : "Song");

/** Same image the library list uses: cover art, else the writer portrait. Undefined → draw coverSvg. */
export function coverOf(song: Song, size: "thumb" | "full" = "full"): { src: string; portrait: boolean } | undefined {
  if (song.artUrl) {
    const src = size === "thumb" ? (song.thumbUrl || song.artUrl.replace(/art\.webp$/, "art-thumb.webp")) : song.artUrl;
    return { src, portrait: false };
  }
  if (song.writerPortraitUrl) return { src: song.writerPortraitUrl, portrait: true };
}

export const themeList = (song: Song) => (song.themes || "").split(",").map(t => t.trim()).filter(Boolean);

export const songRecency = (s: Song) => {
  const t = Date.parse(s.publishedAt || s.createdAt || "");
  return Number.isNaN(t) ? s.year || 0 : t;
};
