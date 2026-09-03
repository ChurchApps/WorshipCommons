import registry from "./licenses.json";
import type { Song } from "./songs";

// The six content licenses, vendored from WorshipCommonsContent/licenses/licenses.json (keep byte-identical).
// Every "is this WC or PD" branch in the site goes through here so a CC row never wears the wrong badge.
export interface License {
  id: string;
  spdx: string | null;
  label: string;
  versionDefault: string;
  section: string;
  deedUrl: string;
  legalUrl: string | null;
  attributionRequired: boolean;
  shareAlike: boolean;
  nonCommercial: boolean;
  derivativesAllowed: boolean;
  uploadable: boolean;
  may: string[];
  mayNot: string[];
  must: string[];
  notice: string;
  badge: string;
}

export const LICENSES: License[] = registry.licenses;
const BY_ID = Object.fromEntries(LICENSES.map(l => [l.id, l]));
export const UPLOADABLE = LICENSES.filter(l => l.uploadable);

// unknown codes fall back to WC: the most restrictive of the two the site used to hardcode
export const licenseById = (id?: string | null): License => BY_ID[id || ""] || BY_ID.WC;
export const licenseOf = (song: Pick<Song, "license">): License => licenseById(song.license);

/** Version to print: the song's own (3.0, CC0…) else the registry default (4.0, 1.0). */
export const licenseVersion = (song: Pick<Song, "license" | "licenseVersion">) => song.licenseVersion || licenseOf(song).versionDefault;

/** The exact license the writer applied, else the registry deed — a CC BY 3.0 song must never read as 4.0. */
export const licenseUrl = (song: Pick<Song, "license" | "licenseUrl">) => song.licenseUrl || licenseOf(song).deedUrl;

/** One-line notice for LICENSE.txt and the print footer: placeholders {year} {writer} {version} {licenseUrl}. */
export function licenseNotice(song: Pick<Song, "license" | "licenseVersion" | "licenseUrl" | "year" | "writer">): string {
  const vars: Record<string, string> = { year: String(song.year ?? ""), writer: song.writer, version: licenseVersion(song), licenseUrl: licenseUrl(song) };
  return licenseOf(song).notice.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

/** Where the site explains this license: WC keeps its brand page, everything else is a card on it. */
export const licenseHref = (id: string) => (id === "WC" ? "/license" : `/license#${licenseById(id).badge}`);
