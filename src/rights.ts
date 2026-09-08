import type { RightsMatrix, Song, Use, UseRule } from "./songs";

export const USES: Use[] = ["project", "print", "stream", "arrange", "record"];

const all = (allowed: boolean, ...conditions: string[]): RightsMatrix =>
  Object.fromEntries(USES.map(u => [u, { allowed, conditions: [...conditions] } as UseRule])) as RightsMatrix;

// One license id → what it permits. Mirrors the server helper (Api commons RightsHelper); the site only
// uses this when the API did not send rightsMatrix. Keep the two in step.
export function matrixForLicense(id: string): RightsMatrix {
  const up = (id || "").toUpperCase();
  if (up === "PD" || up === "CC0") return all(true);
  if (up === "WC") {
    const m = all(true);
    const nc = "Not monetized: no ads, paid downloads, or ticketed streams";
    m.stream.conditions.push(nc);
    m.record.conditions.push(nc);
    return m;
  }
  if (up.startsWith("CC-BY")) {
    const m = all(true, "Credit the writer and link the license");
    if (up.includes("-NC")) for (const u of USES) m[u].conditions.push("Non-commercial use only");
    if (up.includes("-SA")) {
      m.arrange.conditions.push("Share alike: release your arrangement or translation under the same license");
      m.record.conditions.push("Share alike: a recording carries the same license");
    }
    if (up.includes("-ND")) m.arrange = { allowed: false, conditions: ["No derivatives: no arrangements, translations, or transposed charts may be distributed"] };
    return m;
  }
  return all(false, "License not recognised");
}

const dedupe = (xs: string[]) => [...new Set(xs)];

/** Compose every present rights layer: a use is allowed only when every layer allows it. */
export function composeMatrix(layers: (string | null | undefined)[]): RightsMatrix {
  const ms = layers.filter(Boolean).map(l => matrixForLicense(l as string));
  if (!ms.length) return all(false, "No rights recorded");
  return Object.fromEntries(USES.map(u => [u, { allowed: ms.every(m => m[u].allowed), conditions: dedupe(ms.flatMap(m => m[u].conditions)) }])) as RightsMatrix;
}

const layerLicenses = (song: Song): string[] => {
  const rows = song.rights ? Object.values(song.rights).filter(Boolean) : [];
  return rows.length ? rows.map(r => r.license) : [song.license];
};

export const rightsMatrixFor = (song: Song): RightsMatrix => song.rightsMatrix || composeMatrix(layerLicenses(song));

const FREE = /^(PD|CC0|WC|CC-BY)/i;
/** True when a US church must report project/print use to CCLI. Every PD / CC / WC package is false. */
export function needsCcliReport(song: Song): boolean {
  if (typeof song.ccliReport === "boolean") return song.ccliReport;
  return !layerLicenses(song).every(l => FREE.test(l || ""));
}

/** The ND switch: transpose, capo, Nashville, arrangement downloads, and generated audio stay off. */
export const noDerivatives = (song: Song) => !rightsMatrixFor(song).arrange.allowed;
