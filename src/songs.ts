import { folderSlug } from "./slug.mjs";
import { attachListMedia, contentRootFromApi } from "./listMedia.mjs";
export { idOf, songPath, writerPath } from "./slug.mjs";
import { CORE_API, wcGet } from "./api";
import themeVocabulary from "./themes.json";

// ---- package model: what masters/ and derivatives/ hold, as the API reports it ----
export type Confidence = "sunday-ready" | "score" | "generated-from-midi" | "chart-only" | "lyrics-only";
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
  /** registry id from licenses.json: the six featured grants, or a custom writer grant */
  license: string;
  licenseVersion?: string;
  licenseUrl?: string;
  /** CCLI song id when the writer listed one. Presence does not mean reporting is required. */
  ccli?: string | null;
  downloadCount: number;
  saveCount?: number;
  likeCount: number;
  chordPro?: string;
  path?: string;
  files?: string;
  fileUrls?: Record<string, string>;
  demoAudioUrl?: string;
  masterUrl?: string;
  sheetPdfUrl?: string;
  stemsZipUrl?: string;
  compositionZipUrl?: string;
  audioZipUrl?: string;
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
  // list rows: fixed media paths, rebuilt in attachListMedia
  packageDir?: string;
  hasCover?: boolean;
  hasMidi?: boolean;
  hasDemo?: boolean;
  hasStems?: boolean;
  coverOnParent?: boolean;
  midiOnParent?: boolean;
  portrait?: string;
}

let cache: Song[] | null = null;
let cacheAt = 0;
const songCache = new Map<string, Song | null>();
// Hold a good catalog response. Tab focus must not download it again.
const LIST_TTL_MS = 60 * 60 * 1000;

export function isMissingSong(err: unknown): boolean {
  return err instanceof Error && /\(404\)/.test(err.message);
}

// the API ships one fileUrls map (media key → absolute URL); fan it back out to the
// legacy per-file fields so the rest of the site keeps its vocabulary
const URL_FIELDS: [keyof Song, string][] = [
  ["demoAudioUrl", "demoAudio"],
  ["masterUrl", "master"],
  ["sheetPdfUrl", "sheetPdf"],
  ["stemsZipUrl", "stemsZip"],
  ["compositionZipUrl", "compositionZip"],
  ["audioZipUrl", "audioZip"],
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
export function fileUrl(song: Pick<Song, "fileUrls">, ...keys: string[]): string | undefined {
  const u = song.fileUrls || {};
  for (const k of keys) if (u[k]) return u[k];
  return undefined;
}

const AUDIO_EXT = /\.(mp3|wav|m4a|ogg|flac)(\?|#|$)/i;

/** A listen-able recording: listed demo, listed master, or a harvested writer MP3 mis-keyed as "song". */
export function recordingUrlOf(song: Pick<Song, "demoAudioUrl" | "masterUrl" | "fileUrls">): string | undefined {
  const u = song.demoAudioUrl || song.masterUrl || fileUrl(song, "demoAudio", "master", "song");
  return u && AUDIO_EXT.test(u) ? u : undefined;
}

export const hasDemoRecording = (song: Song) => !!recordingUrlOf(song);

/** Vocal-free bed built from the stems (output/audio/instrumental.m4a) — the karaoke track when there is one. */
export const instrumentalUrlOf = (song: Pick<Song, "fileUrls">) => Object.values(song.fileUrls || {}).find(u => /(^|[-/])instrumental\.m4a(\?|#|$)/i.test(u));

/** Files granted as-is and never processed (sources/extra/*): tabs, alternate recordings, accompaniment tracks. */
export const extraFilesOf = (song: Pick<Song, "fileUrls">) =>
  Object.values(song.fileUrls || {}).filter(u => /\/sources\/extra\//.test(u)).map(u => ({ url: u, name: decodeURIComponent(u.split("/").pop() || "") }));

/** CDN origin + /commons prefix, so shared assets (pads) can be addressed from any song. */
export function contentRootOf(song: Song): string {
  const u = Object.values(song.fileUrls || {}).find(Boolean) || song.midiUrl || song.abcUrl || song.artUrl || "";
  const hit = ["/songs/", "/assets/", "/writers/"].map(s => String(u).indexOf(s)).filter(n => n > 0).sort((a, b) => a - b)[0];
  return hit ? String(u).slice(0, hit) : "";
}

// Only substitutes when the URL really sits in a package folder. String.replace returns the subject
// unchanged on no match, so without this guard a pipeline-layout URL (output/composition/chart.pdf)
// came back as itself and every song rendered a "Click" player pointing at its chart PDF.
const beside = (url: string | undefined, name: string) => {
  if (!url) return undefined;
  const next = url.replace(/\/(sources|masters|derivatives)\/[^/?#]+$/, `/derivatives/${name}`);
  return next === url ? undefined : next;
};

/**
 * Kit files live in derivatives/ but the API's fileUrls map does not list them yet.
 * Build the URL next to the tune (midi or abc) or the song chart. The pipeline layout
 * (output/composition/) carries no kit audio, so there nothing is guessed and no player shows.
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
  Zulu: "zu",
  Swedish: "sv",
  Dutch: "nl",
  Italian: "it",
  Chinese: "zh",
  Afrikaans: "af",
  Maltese: "mt",
  Romanian: "ro",
  Slovak: "sk",
  Finnish: "fi"
};
const licenseSection = (id: string) => id === "PD" ? "public-domain" : id === "WC" ? "wc-license" : id.toLowerCase();

export function contentPrefix(song: Song): string {
  return contentRootOf(song) || `${CORE_API.replace(/\/$/, "")}/content/commons`;
}

/** songs/<lang>/<section>/<slug>-<id> as the content bucket lays it out. */
export function packageDir(song: Song): string | undefined {
  const fromUrl = Object.values(song.fileUrls || {}).concat(song.midiUrl || "", song.abcUrl || "").find(u => /\/songs\//.test(String(u)));
  const hit = String(fromUrl || "").match(/\/(songs\/.+?)\/(?:sources|masters|derivatives|output)\//);
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
  // listed URLs first: a translation's score lives in its parent's package, so guessing its own 403s
  const midi = [
    [fileUrl(song, "score")].find(u => /\.mid(\?|#|$)/i.test(u || "")),
    song.midiUrl,
    fileUrl(song, "midi"),
    packageFile(song, "output/composition/score.mid"),
    packageFile(song, "sources/tune.mid")
  ].filter((u, i, a): u is string => !!u && a.indexOf(u) === i);
  const timing = song.lyricsUrl || fileUrl(song, "timing") || packageFile(song, "sources/timing.json") || packageFile(song, "derivatives/timing.json");
  return { midi, timing };
}

/** Melody URL the API already listed — no HEAD. */
export function listedMidi(song: Song): string | undefined {
  return song.midiUrl || fileUrl(song, "midi");
}

/** Lead worship can run: a listed melody plus lyrics (ChordPro or timing.json). Word-level timing is optional — the player spreads ChordPro across the tune. */
export function canLead(song: Song) {
  const hasTune = !!(listedMidi(song) || recordingUrlOf(song));
  return !!(hasTune && (song.chordPro || song.lyricsUrl || fileUrl(song, "timing") || song.hasTiming));
}

const listed = (song: Song, url?: string) =>
  !!url && (url === song.midiUrl || url === song.lyricsUrl || url === fileUrl(song, "midi") || url === fileUrl(song, "timing"));

async function urlOk(song: Song, url?: string) {
  if (!url) return false;
  if (listed(song, url)) return true;
  try { return (await fetch(url, { method: "HEAD" })).ok; } catch { return false; }
}

/** Confirm a melody file exists (API listings skip it; the file is still on the content bucket). Timing.json is optional. */
export async function resolveLead(song: Song): Promise<{ midi?: string; timing?: string }> {
  const files = leadFiles(song);
  let midi: string | undefined;
  for (const u of files.midi) if (await urlOk(song, u)) { midi = u; break; }
  return { midi, timing: listed(song, files.timing) ? files.timing : undefined };
}

/** Pipeline stems pack: a zip in output/audio/, not the listening pack at output/audio.zip. */
export function stemsZipUrlOf(song: Pick<Song, "stemsZipUrl" | "fileUrls">): string | undefined {
  if (song.stemsZipUrl) return song.stemsZipUrl;
  return Object.values(song.fileUrls || {}).find(u => /\/output\/audio\/[^/?#]+\.zip(\?|#|$)/i.test(u));
}

/** The library badge. The download link stays on the song page, which has the real zip URL. */
export function hasStemsPack(song: Pick<Song, "hasStems" | "stemsZipUrl" | "fileUrls">): boolean {
  return !!song.hasStems || !!stemsZipUrlOf(song);
}

export function songFromApi(raw: any): Song {
  const urls = raw.fileUrls || {};
  for (const [field, key] of URL_FIELDS) if (urls[key]) raw[field] = urls[key];
  // harvested writer recordings live at sources/master/song.mp3; basename "song" used to collide with song.json
  if (!raw.demoAudioUrl && AUDIO_EXT.test(urls.song || "")) raw.demoAudioUrl = urls.song;
  // catalog.json already names stemsZipUrl; recover when the API still keys the pack by its title-BPM filename
  if (!raw.stemsZipUrl) raw.stemsZipUrl = stemsZipUrlOf(raw);
  if (!raw.hasAccompaniment) raw.hasAccompaniment = !!(instrumentalUrlOf(raw) || raw.stemsZipUrl);
  if (raw.confidence === "proofread-score" || raw.confidence === "converted-from-abc") raw.confidence = "score";
  return raw as Song;
}

// list payload is summaries only — no chordPro/scriptureText; use loadSong for the full record
export function clearSongCache() {
  cache = null;
  cacheAt = 0;
  songCache.clear();
}

export async function loadSongs(): Promise<Song[]> {
  if (cache && Date.now() - cacheAt < LIST_TTL_MS) return cache;
  const songs = (await wcGet("/songs") as any[]).map(songFromApi);
  attachListMedia(songs, contentRootFromApi(CORE_API));
  cache = songs;
  cacheAt = Date.now();
  return songs;
}

export async function loadSong(id: string): Promise<Song | null> {
  if (songCache.has(id)) return songCache.get(id) ?? null;
  try {
    const song = songFromApi(await wcGet(`/songs/${id}`));
    songCache.set(id, song);
    return song;
  } catch (err) {
    if (!isMissingSong(err)) throw err;
    songCache.set(id, null);
    return null;
  }
}

export interface HistoryEntry { submissionId: string; submittedByName?: string; approvedAt?: string; note?: string; filesChanged?: { name: string; action: string }[] }
export interface SongPageData {
  song: Song;
  history: HistoryEntry[];
  /** parent + siblings + children via parentSongId, in catalog order */
  family: Song[];
  /** top matches in the same language, each with a one-sentence reason */
  similar: (Song & { reason?: string })[];
}

// The one fetch the song page needs: detail + history + family + similar.
export async function loadSongPage(id: string): Promise<SongPageData | null> {
  try {
    const raw = await wcGet(`/songs/${id}/page`, true);
    if (!raw?.song) return null;
    return {
      song: songFromApi(raw.song),
      history: raw.history || [],
      family: (raw.family || []).map(songFromApi),
      similar: (raw.similar || []).map(songFromApi)
    };
  } catch (err) {
    if (isMissingSong(err)) return null;
    throw err;
  }
}

// the controlled vocabulary, in the order it should be offered and faceted
export const THEMES: string[] = themeVocabulary.themes;

export { isModernWorship, MODERN_YEAR } from "./era";
import { isModernWorship } from "./era";

export const kindOf = (song: Song) => (isModernWorship(song) ? "Song" : "Hymn");

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
