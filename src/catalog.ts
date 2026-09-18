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
 * Editorial "Start here" set: well-known English PD hymns that already have a typeset
 * score (Open Hymnal ABC) and a chord chart. Not Sunday-ready — that stamp is the listen gate.
 * Order is hymnal ubiquity, then a few Christmas/Easter titles churches actually start with.
 */
export const START_HERE_IDS = [
  "T0B8i41oasf", // All Hail the Power of Jesus' Name
  "b13IrZfZXWm", // Rock of Ages
  "ggzFvLEr9mK", // Nearer, My God, to Thee
  "PcwqBQ0pxuT", // Blest Be the Tie That Binds
  "jY7zZ5DB4YC", // My Faith Looks Up to Thee
  "FMd8ryghVRb", // Come Thou Fount Of Every Blessing
  "WE26JDTfHyQ", // How Firm a Foundation
  "5XkXjIIePgD", // When I Survey the Wondrous Cross
  "_X94hS2ZTgf", // Joy to the World
  "QnYa8cJdeLc", // Guide Me, O Thou Great Jehovah
  "DmZMgNX0L6p", // What a Friend We Have in Jesus
  "w5-RXH9uPli", // Jesus Shall Reign
  "gspxyxVctNx", // Come, Thou Almighty King
  "3tR86sWVTNC", // O For a Thousand Tongues to Sing
  "Ft0nnpxQbbt", // Abide with Me
  "Z8zZ1SBRMoo", // Holy, Holy, Holy
  "YxPfAFYWOaG", // Amazing Grace
  "2F9k4IkmoHX", // Doxology
  "pSpS9dU7qHg", // Hark! The Herald Angels Sing
  "GewWFBLDxRd", // He Leadeth Me
  "XHeQW0SBedC", // Take My Life and Let It Be
  "erVpuKigTL9", // O God, Our Help in Ages Past
  "TtpzMXOT4AO", // Jesus Christ Is Risen Today
  "0YyJoAE9Ge4", // Blessed Assurance
  "Uo8aHwRz1ez", // Savior, Like a Shepherd Lead Us
  "wy7meh0qqDc", // My Hope Is Built
  "_ALrpxFXZIG", // I Need Thee Every Hour
  "2zMeQ2kdb2n", // Pass Me Not, O Gentle Savior
  "a19OdmA8uPt", // O Little Town of Bethlehem
  "mp8_CK_E5qS", // The Church's One Foundation
  "MUIfLlOxrqc", // Faith of Our Fathers
  "zfrKD0J-OPJ", // Crown Him with Many Crowns
  "_UFqNA48X8n", // It Is Well with My Soul
  "9jxQoj5H8ma", // A Mighty Fortress Is Our God
  "DdnkGm4QMhD", // Silent Night
  "e0RA7WIC3mU", // O Come, All Ye Faithful
  "sdbr4rHG9yR", // The Old Rugged Cross
  "yumBImJYymh", // To God Be the Glory
  "HLUq1nNdYTI", // Be Thou My Vision
  "efSPV6ob7E5"  // Fairest Lord Jesus
] as const;

export const START_HERE = new Set<string>(START_HERE_IDS);

/**
 * The first block, ranked within the UI language: Sunday-ready only when the listen gate
 * has actually run; otherwise the Start here set; otherwise scored titles under a heading
 * that says so. Featured is not Sunday-ready.
 * The heading is an English key for t().
 */
export function topBlock(songs: Song[], language: string): { heading: string; songs: Song[] } {
  const inLang = songs.filter(s => s.language === language).sort(byRank);
  const sunday = inLang.filter(s => s.sundayReady);
  if (sunday.length) return { heading: "Sunday-ready", songs: sunday };
  const start = inLang.filter(s => START_HERE.has(s.id));
  if (start.length) return { heading: "Start here", songs: start };
  const scored = inLang.filter(s => s.hasScore);
  if (scored.length) return { heading: "Scored hymns, ready to sing", songs: scored };
  return { heading: "Most downloaded in the commons", songs: inLang };
}
