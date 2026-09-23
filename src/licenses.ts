import registry from "./licenses.json";
import type { RightsLayer, Song, Use } from "./songs";

// License registry, vendored from WorshipCommonsContent/licenses/licenses.json (keep byte-identical).
// The six with listed !== false are the featured grants on /license. Custom rows are valid
// song.json ids and get a song-page deed + link to legalUrl, not a card on the hub.
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
  listed?: boolean;
  custom?: boolean;
  ccliReport?: boolean;
  may: string[];
  mayNot: string[];
  must: string[];
  notice: string;
  badge: string;
}

export const LICENSES: License[] = registry.licenses;
const BY_ID = Object.fromEntries(LICENSES.map(l => [l.id, l]));
export const UPLOADABLE = LICENSES.filter(l => l.uploadable);
/** The six featured grants on /license. Custom writer terms stay off that page. */
export const FEATURED_LICENSES = LICENSES.filter(l => l.listed !== false);
export const FEATURED_IDS = new Set(FEATURED_LICENSES.map(l => l.id));
export const isCustomLicense = (l: License) => l.custom === true || l.listed === false;

/** Sidebar bucket: the six featured grants, or "custom" for every other writer grant. */
export function licenseGroup(id?: string | null): string {
  if (!id) return "";
  if (FEATURED_IDS.has(id)) return id;
  return "custom";
}

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

/** One human line per present rights layer, for the print footer and the About panel.
 *  label/href resolve the license id ("larry-holder" → "Custom — Larry Holder Music"); a bare id that is not in
 *  the registry prints as-is rather than falling back to WC. Basis parts that just repeat the license id are dropped,
 *  so a license slug never reads as the author. */
export const layerLines = (song: Pick<Song, "rights">): { layer: RightsLayer; license: string; label: string; href: string | null; basis: string }[] =>
  LAYERS.flatMap(layer => {
    const row = song.rights?.[layer];
    if (!row) return [];
    const known = BY_ID[row.license] || ccFallback(row.license);
    const basis = [row.basis, row.holder, row.source, row.note].filter(p => p && p !== row.license).join(" · ");
    return [{ layer, license: row.license, label: known?.label ?? row.license, href: known ? licenseHref(row.license) : null, basis }];
  });

/** Where the site explains this license: WC brand page, featured cards on it, custom grants on the writer's own page. */
export const licenseHref = (id: string) => {
  const l = licenseById(id);
  if (isCustomLicense(l)) return l.legalUrl || l.deedUrl;
  return id === "WC" ? "/license" : `/license#${l.badge}`;
};
