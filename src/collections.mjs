// Landing pages for searches the song library answers but a ?theme= link cannot rank for:
// seasonal sets, public-domain hymns, and songs a church can use without a CCLI license.
// Shared by the React app (pages/Collection.tsx) and tools/prerender.mjs, so the copy a
// crawler reads and the page a visitor sees are the same words.

const themesOf = (song) => String(song.themes || "").split(/[,;]/).map(t => t.trim()).filter(Boolean);
const hasTheme = (theme) => (song) => themesOf(song).includes(theme);

// license ids that never need a CCLI report (src/licenses.json marks custom grants with ccliReport: false)
const NO_REPORT = /^(PD|CC0|WC|CC-BY|larry-holder)/i;
export const freeForWorship = (song) => song.ccliReport !== true && NO_REPORT.test(String(song.license || ""));

// A–Z for English, then the other languages grouped under their own heading
/**
 * @template {CollectionSong} T
 * @param {T[]} songs
 * @returns {[string, T[]][]}
 */
export function groupByLanguage(songs) {
  const byLang = new Map();
  for (const s of [...songs].sort((a, b) => String(a.title).localeCompare(String(b.title)))) {
    const lang = s.language || "English";
    if (!byLang.has(lang)) byLang.set(lang, []);
    byLang.get(lang).push(s);
  }
  return [...byLang.entries()].sort((a, b) => (a[0] === "English" ? -1 : b[0] === "English" ? 1 : b[1].length - a[1].length || a[0].localeCompare(b[0])));
}

/**
 * @typedef {{ id: string, title: string, writer: string, year?: number|string, language?: string, license?: string, themes?: string, rank?: number, songKey?: string, ccliReport?: boolean }} CollectionSong
 * @typedef {{ slug: string, path: string, title: string, h1: string, description: string, intro: string[], match: (song: any) => boolean, theme?: string, faq?: [string, string][], limit?: number }} Collection
 */

/** @returns {Collection} */
const seasonal = (slug, theme, title, h1, description, intro) => ({
  slug,
  path: `/songs/${slug}`,
  theme,
  title,
  h1,
  description,
  intro,
  match: hasTheme(theme)
});

/** @type {Collection[]} */
export const COLLECTIONS = [
  {
    slug: "hymns",
    path: "/hymns",
    title: "Public domain hymns — free chords and lyrics | WorshipCommons",
    h1: "Public domain hymns",
    description: "Public domain hymns with free chord charts, lyrics, and audio. Sing, print, project, and stream them in worship with no license and no CCLI report.",
    intro: [
      "These hymns are in the public domain in the United States. Anyone may sing, print, project, record, or stream them without asking permission, paying a fee, or reporting to CCLI.",
      "In the US, a song published in 1930 or earlier is in the public domain as of 2026. Songs first published in 1931 join them on January 1, 2027. A newer translation or arrangement of an old hymn can still be under copyright, and other countries count from the writer's death instead, so each song page names its own license.",
      "Every hymn here has a chord chart you can transpose to any key, the full lyrics, and a melody you can hear before Sunday."
    ],
    match: (song) => song.license === "PD" && (song.language || "English") === "English" && Number(song.year) > 0 && Number(song.year) <= 1930
  },
  {
    slug: "no-ccli",
    path: "/no-ccli",
    title: "Worship songs you can use without a CCLI license | WorshipCommons",
    h1: "Worship songs you can use without a CCLI license",
    description: "Every song in WorshipCommons is free for worship: public domain hymns and songs shared by their writers. Project, print, and stream them with no CCLI license or report.",
    intro: [
      "A CCLI Church Copyright License lets a church reproduce copyrighted songs, for example projecting lyrics or printing a song sheet, and asks the church to report what it used. Songs that are in the public domain, or that their writers have licensed for free worship use, do not need it.",
      "Every song listed here is one of those. Public domain hymns carry no restrictions at all. Songs shared under the WorshipCommons License may be sung, projected, printed, arranged, translated, and recorded or streamed as part of a worship gathering, free and forever. A few songs carry a Creative Commons license or the writer's own grant instead, which can ask for credit or limit use to non-profit settings. Each song page names its license.",
      "A CCLI number on a song page is for churches that report anyway. Reporting it is optional."
    ],
    faq: [
      ["Do we need a CCLI license to use these songs?", "No. Public domain songs need no license, and songs under the WorshipCommons License already give every church permission for worship use. You do not register, report, or pay."],
      ["Can we livestream or post our service with these songs?", "Yes. Recording or streaming a worship gathering is part of worship use under the WorshipCommons License, and public domain songs have no restrictions. Selling a recording of the song is different and needs the writer."],
      ["Can we print or project the lyrics and chords?", "Yes. Print chord charts and lyric sheets for the people gathered, and put the words on a screen. Giving copies away is fine; selling them as a product is not."],
      ["What about other songs our church sings?", "Copyrighted songs from outside WorshipCommons still need whatever license their writers or publishers require, such as a CCLI license."]
    ],
    match: freeForWorship,
    limit: 80
  },
  seasonal("christmas", "Christmas", "Free Christmas songs and carols for church — chords and lyrics | WorshipCommons", "Christmas songs and carols for church", "Free Christmas hymns and carols for your church: chord charts in any key, lyrics, and audio. Public domain and free for worship, with no CCLI report.", [
    "Classic carols and Christmas hymns your congregation already knows, plus newer songs shared by their writers, ready for a Christmas Eve service, a carol sing, or a children's program.",
    "Every song has a chord chart you can move to any key, full lyrics for the screen, and a melody to rehearse with. All of them are free for worship use: no subscription and no CCLI report."
  ]),
  seasonal("advent", "Advent", "Advent hymns and songs for church — free chords and lyrics | WorshipCommons", "Advent hymns and songs", "Free Advent hymns for the four Sundays before Christmas: chord charts in any key, lyrics, and audio, free for worship with no CCLI report.", [
    "Songs of waiting, longing, and promise for the four Sundays of Advent, from ancient hymns like O Come, O Come, Emmanuel to newer songs shared by their writers.",
    "Each one has a chord chart in any key, lyrics, and a melody to rehearse with, and every one is free for worship use."
  ]),
  seasonal("easter", "Easter", "Easter hymns and songs for church — free chords and lyrics | WorshipCommons", "Easter hymns and songs", "Free Easter hymns and resurrection songs for church: chord charts in any key, lyrics, and audio, free for worship with no CCLI report.", [
    "Resurrection hymns and songs for Easter Sunday and the weeks after, with chord charts in any key, full lyrics, and audio.",
    "All of them are free for worship use, so you can print, project, and stream them without a license or a report."
  ]),
  seasonal("communion", "Communion", "Communion hymns and songs for the Lord's Supper — free chords | WorshipCommons", "Communion hymns and songs", "Free songs and hymns for communion and the Lord's Supper: chord charts in any key, lyrics, and audio, free for worship with no CCLI report.", [
    "Hymns and songs for the Lord's Supper, for singing while the table is prepared, as the bread and cup are shared, or as a response afterward.",
    "Each has a chord chart in any key, lyrics, and a melody, and every one is free for worship use."
  ]),
  seasonal("thanksgiving", "Thanksgiving", "Thanksgiving hymns and songs for church — free chords and lyrics | WorshipCommons", "Thanksgiving hymns and songs", "Free Thanksgiving hymns and harvest songs for church: chord charts in any key, lyrics, and audio, free for worship with no CCLI report.", [
    "Hymns of gratitude and harvest for a Thanksgiving service, with chord charts in any key, full lyrics, and audio.",
    "All of them are free for worship use: print, project, and stream them without a license or a report."
  ])
];

/** @param {string} slug @returns {Collection} */
export const collectionBySlug = (slug) => COLLECTIONS.find(c => c.slug === slug);

/**
 * The songs a collection lists, most-used first when the page is capped.
 * @template {CollectionSong} T
 * @param {Collection} collection
 * @param {T[]} songs
 * @returns {T[]}
 */
export function collectionSongs(collection, songs) {
  const hits = (songs || []).filter(collection.match);
  if (!collection.limit) return hits;
  return [...hits].sort((a, b) => (Number(b.rank) || 0) - (Number(a.rank) || 0) || String(a.title).localeCompare(String(b.title))).slice(0, collection.limit);
}
