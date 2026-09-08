import type { Song } from "./songs";

// ---- catalog vs browse language ----
// A language is a catalog once it has a Sunday-ready set of its own; until then it is a
// browse language: searchable and badged, but not counted in the headline totals.
export const CATALOG_THRESHOLD = 25;

export function isCatalogLanguage(songs: Song[], language: string): boolean {
  let ready = 0, scored = 0;
  for (const s of songs) {
    if (s.language !== language) continue;
    if (s.sundayReady) ready++;
    if (s.hasScore) scored++;
  }
  if (ready >= CATALOG_THRESHOLD) return true;
  // ponytail: until the listen gate has run, a language with 25 scored packages counts as a catalog; drop the fallback once Sunday-ready titles exist
  return scored >= CATALOG_THRESHOLD;
}

/** Every language in the list, split by the rule above; each side sorted by song count desc. */
export function splitLanguages(songs: Song[]): { catalog: string[]; browse: string[] } {
  const counts: Record<string, number> = {};
  songs.forEach(s => { counts[s.language] = (counts[s.language] || 0) + 1; });
  const langs = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  const catalog = langs.filter(l => isCatalogLanguage(songs, l));
  return { catalog, browse: langs.filter(l => !catalog.includes(l)) };
}

// ---- completeness ----
/** User #1's filter: a chart with chords plus something to play under it. */
// ponytail: a converted score gives a synthesized piano preview today; tighten to hasAccompaniment once renders exist
export const guitarReady = (s: Song) => !!s.hasChords && !!(s.hasAccompaniment || s.hasScore);

const HYMNAL_PRIOR = 200;

/**
 * The one-line "why this leads" under a ranked row, as English keys for t():
 * hymnal prior · has score · chart with chords. Source and license stay off the list rows;
 * the song page carries them.
 */
export function rankReason(s: Song): string[] {
  const signals: string[] = [];
  // hymnalCount rides on the summary row but is not on the Song type (the type belongs to the contract job)
  if (((s as Song & { hymnalCount?: number }).hymnalCount ?? 0) >= HYMNAL_PRIOR) signals.push("in 200+ hymnals");
  if (s.hasScore) signals.push("has score");
  if (s.hasChords) signals.push("chart with chords");
  return signals;
}

// ---- homepage ----
const byRank = (a: Song, b: Song) => (b.rank ?? 0) - (a.rank ?? 0);

/**
 * The first block, ranked within the UI language: Sunday-ready, then featured; when neither
 * exists yet, the best scored titles under a heading that says so — never "Sunday-ready".
 * The heading is an English key for t().
 */
export function topBlock(songs: Song[], language: string): { heading: string; songs: Song[] } {
  const inLang = songs.filter(s => s.language === language).sort(byRank);
  const ready = [...inLang.filter(s => s.sundayReady), ...inLang.filter(s => s.featured && !s.sundayReady)];
  if (ready.length) return { heading: "Sunday-ready", songs: ready };
  const scored = inLang.filter(s => s.hasScore);
  if (scored.length) return { heading: "Scored hymns, ready to sing", songs: scored };
  return { heading: "Most downloaded in the commons", songs: inLang };
}
