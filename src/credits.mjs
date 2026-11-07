import { writerPath } from "./slug.mjs";

// Song credits are free text ("Fanny Crosby & John Sweney", "Isaac Watts · tr. Jan Foss",
// "Irish, 8th c. · tr. Byrne"). Writer pages are keyed on the person, not the credit string,
// so one hymn writer gets one page however many co-writers and translators they appear with.
// Shared by the React app and tools/prerender.mjs: both must agree on ids and paths.

const SEPARATORS = /\s*(?:\s\/\s|\s&\s|\s•\s|;\s*|\sand\s|\sund\s|\sy\s|\set\s|,(?!\s*(?:jr|sr|ii|iii|iv)\.?(?:$|[\s,]))\s*)\s*/i;
const SUFFIX = /^(?:jr|sr|ii|iii|iv)\.?$/i;

// collective or descriptive credits that are not a person and get no writer page
const NOT_PERSON = new RegExp([
  "^anon",
  "anónimo",
  "anonyme",
  "^anonym",
  "^unknown",
  "^desconocido",
  "tradi[ct]",
  "^trad\\.?$",
  "^composite$",
  "^various",
  "spiritual",
  "\\bhymn\\b",
  "psalter",
  "\\bcarol\\b",
  "\\bmelody\\b",
  "\\bfolk\\b",
  "plainsong",
  "plainchant",
  "liturgy",
  "\\bchant\\b",
  "\\bc\\.$",
  "\\bcentury\\b",
  "\\d",
  "^latin$",
  "^greek$",
  "^german$",
  "^irish$",
  "^welsh$",
  "^scottish$",
  "^english$",
  "^french$",
  "^ancient",
  "^early ",
  "^medieval",
  "^source",
  "^based on",
  "^from ",
  "^attr",
  "^arr\\b",
  "^tr\\b",
  "^adapt",
  "^para\\.?$",
  "^the ",
  "\\bbrasileñ",
  "\\bamerican\\b",
  "\\bafrican\\b",
  "\\bindia\\b"
].join("|"), "i");

const clean = (s) => String(s || "").normalize("NFC").replace(/\s+/g, " ").replace(/^[\s,.;:–—-]+|[\s,;:–—-]+$/g, "").trim();

/** One person in a credit, or null when the text is a collective credit ("Traditional", "Irish, 8th c."). */
export function personName(raw) {
  const name = clean(raw).replace(/^(?:words|music|text|lyrics|tune)\s*(?::|by\b)\s*/i, "");
  if (!name || NOT_PERSON.test(name)) return null;
  const tokens = name.split(" ").filter(t => !SUFFIX.test(t.replace(/,$/, "")));
  // a person has a given name and a family name; one word is a tune, a nation, or a nickname
  if (tokens.length < 2) return null;
  return name;
}

const splitPeople = (segment) => clean(segment).split(SEPARATORS).map(clean).filter(Boolean);

/**
 * Split a credit into its people, in order. role is "writer" for the main credit and
 * "translator" / "arranger" for "· tr." and "· arr." segments. Other "·" segments name a tune
 * or a place ("· Greensleeves", "· Assam, India") and are left out.
 */
/** @param {string} writer @returns {{ name: string, role: string }[]} */
export function parseCredit(writer) {
  const segments = String(writer || "").split(/\s+·\s+/);
  const people = [];
  segments.forEach((segment, i) => {
    let role = i === 0 ? "writer" : null;
    let text = segment;
    const tagged = /^(tr|trans|transl|arr|adapt)\.?\s+(?:by\s+)?(.*)$/i.exec(clean(segment));
    if (tagged) {
      role = /^arr|^adapt/i.test(tagged[1]) ? "arranger" : "translator";
      text = tagged[2];
    }
    if (!role) return;
    for (const part of splitPeople(text)) {
      const name = personName(part);
      if (name && !people.some(p => p.name === name && p.role === role)) people.push({ name, role });
    }
  });
  return people;
}

const fold = (s) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** "Fanny J. Crosby" and "Fanny Crosby" are one person: key on the first and last name. */
export function personKey(name) {
  const tokens = fold(name).replace(/\./g, " ").split(/\s+/).filter(t => t && !SUFFIX.test(t));
  if (!tokens.length) return "";
  return tokens.length === 1 ? tokens[0] : `${tokens[0]} ${tokens[tokens.length - 1]}`;
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/**
 * @typedef {{ id: string, title?: string, writer: string, [key: string]: any }} CreditSong
 * @typedef {{ id: string, name: string, path: string, songs: { song: any, role: string }[], indexable: boolean }} Person
 * @typedef {{ id: string, name: string, role: string, path: string }} CreditPerson
 */

/** Stable 11-character id from the person key, the same shape as song and author ids so idOf() reads it. */
export function personId(name) {
  const key = personKey(name);
  let h1 = 0x811c9dc5, h2 = 0x01000193 ^ 0x9e3779b9;
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
    h2 = (h2 ^ (h2 >>> 15)) >>> 0;
  }
  let out = "";
  let bits = (BigInt(h1) << 32n) | BigInt(h2);
  for (let i = 0; i < 11; i++) {
    out += B64[Number(bits & 63n)];
    bits >>= 6n;
  }
  return out;
}

export const personPath = (name) => writerPath(personId(name), name);

/** People with at least this many songs get an indexable writer page; the rest are noindex. */
export const INDEX_MIN_SONGS = 2;

/**
 * Every person in the catalog: { id, name, path, songs: [{ song, role }], indexable }.
 * name is the most common spelling, the longest on a tie ("Frances Ridley Havergal" over "Frances Havergal").
 * @param {CreditSong[]} songs
 * @returns {Person[]}
 */
export function catalogPersons(songs) {
  const byId = new Map();
  for (const song of songs || []) {
    for (const { name, role } of parseCredit(song.writer)) {
      const id = personId(name);
      let person = byId.get(id);
      if (!person) {
        person = { id, spellings: new Map(), songs: [] };
        byId.set(id, person);
      }
      person.spellings.set(name, (person.spellings.get(name) || 0) + 1);
      if (!person.songs.some(s => s.song.id === song.id)) person.songs.push({ song, role });
    }
  }
  return [...byId.values()].map(p => {
    const name = [...p.spellings.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length || a[0].localeCompare(b[0]))[0][0];
    p.songs.sort((a, b) => String(a.song.title).localeCompare(String(b.song.title)));
    return { id: p.id, name, path: writerPath(p.id, name), songs: p.songs, indexable: p.songs.length >= INDEX_MIN_SONGS };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The credit text cut into runs so each person can be linked in place:
 * "Isaac Watts · tr. Jan Foss" → [{ text: "Isaac Watts", person }, { text: " · tr. " }, { text: "Jan Foss", person }].
 * A name the text does not spell out verbatim stays unlinked rather than reordering the credit.
 */
/**
 * @param {string} writer
 * @param {Person[]} [persons]
 * @returns {{ text: string, person?: CreditPerson }[]}
 */
export function creditParts(writer, persons) {
  const text = String(writer || "");
  const parts = [];
  let at = 0;
  for (const person of songPeople({ writer: text }, persons)) {
    const i = text.indexOf(person.name, at);
    if (i < 0) continue;
    if (i > at) parts.push({ text: text.slice(at, i) });
    parts.push({ text: person.name, person });
    at = i + person.name.length;
  }
  if (at < text.length) parts.push({ text: text.slice(at) });
  return parts;
}

/**
 * The people credited on one song, each with the path of their writer page.
 * @param {{ writer: string }} song
 * @param {Person[]} [persons]
 * @returns {CreditPerson[]}
 */
export function songPeople(song, persons) {
  const byId = persons ? new Map(persons.map(p => [p.id, p])) : null;
  return parseCredit(song.writer).map(({ name, role }) => {
    const id = personId(name);
    const person = byId?.get(id);
    return { id, name, role, path: person ? person.path : writerPath(id, name) };
  });
}
