import registry from "./licenses.json";
import type { RightsLayer, Song, Use } from "./songs";

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

// Creative Commons flavours the registry does not carry (the ND ones — harvest-only, never uploadable) still
// need a truthful badge and deed. Build one from the nearest registry row; the legal code at deedUrl controls.
// ponytail: derived on the fly rather than vendored — the registry stays byte-identical to the content repo.
const ccFallback = (id: string): License | null => {
  const m = id.toUpperCase().match(/^CC-BY(-NC)?(-SA)?(-ND)?$/);
  if (!m) return null;
  const base = BY_ID[m[1] ? "CC-BY-NC" : "CC-BY"];
  const flavor = id.toUpperCase().slice(3).toLowerCase();
  const nd = !!m[3];
  return {
    ...base,
    id: id.toUpperCase(),
    spdx: `CC-${flavor.toUpperCase()}-4.0`,
    label: `CC ${flavor.toUpperCase()}`,
    deedUrl: `https://creativecommons.org/licenses/${flavor}/4.0/`,
    legalUrl: `https://creativecommons.org/licenses/${flavor}/4.0/legalcode`,
    shareAlike: !!m[2],
    derivativesAllowed: !nd,
    uploadable: false,
    may: nd ? base.may.filter(k => !/arrange|transpose|translate/i.test(k)) : base.may,
    mayNot: nd ? [...base.mayNot, "Distribute an arrangement, translation, or transposed chart"] : base.mayNot,
    badge: flavor
  };
};

// unknown codes fall back to WC: the most restrictive of the two the site used to hardcode
export const licenseById = (id?: string | null): License => BY_ID[id || ""] || ccFallback(id || "") || BY_ID.WC;
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

/** The credit a church pastes into a bulletin or slide: the package's attribution.txt when served, else the notice line. */
export const attributionFor = (song: Pick<Song, "attribution" | "license" | "licenseVersion" | "licenseUrl" | "year" | "writer">) =>
  (song.attribution || "").trim() || licenseNotice(song);

/** Church-facing name of each use in the rights matrix (English source text; run through t()). */
export const USE_LABEL: Record<Use, string> = { project: "Project", print: "Print", stream: "Stream", arrange: "Arrange or translate", record: "Record" };

const LAYERS: RightsLayer[] = ["text", "translation", "tune", "arrangement", "recording", "artwork"];
export const LAYER_LABEL: Record<RightsLayer, string> = { text: "Text", translation: "Translation", tune: "Tune", arrangement: "Arrangement", recording: "Recording", artwork: "Artwork" };

/** One human line per present rights layer, for the print footer and the About panel. */
export const layerLines = (song: Pick<Song, "rights">): { layer: RightsLayer; license: string; basis: string }[] =>
  LAYERS.flatMap(layer => {
    const row = song.rights?.[layer];
    if (!row) return [];
    const basis = [row.basis, row.holder, row.source, row.note].filter(Boolean).join(" · ");
    return [{ layer, license: row.license, basis }];
  });

/** Where the site explains this license: WC keeps its brand page, everything else is a card on it. */
export const licenseHref = (id: string) => (id === "WC" ? "/license" : `/license#${licenseById(id).badge}`);
