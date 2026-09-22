// ASCII transliteration for the scripts the library actually carries, so a song keeps a readable URL
// instead of collapsing to "untitled". Latin-script titles never reach here — folderSlug already keeps
// Latin-1 and Latin Extended, so "Nun Ruhen Alle Wälder" stays as it is.
//
// The goal is a slug, not scholarship: ASCII only, no diacritics, lossy where that reads better
// (ഖ and ക both give k-sounds a reader can say). Anything from another script is left for the caller
// to drop.

// Russian/Ukrainian-ish Cyrillic. Two-letter forms where English needs them; the soft and hard signs
// vanish rather than becoming apostrophes a slug would strip anyway.
const CYRILLIC = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  ґ: "g",
  д: "d",
  е: "e",
  ё: "yo",
  є: "ye",
  ж: "zh",
  з: "z",
  и: "i",
  і: "i",
  ї: "yi",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya"
};

// Malayalam is an abugida: a consonant carries an inherent "a" that a vowel sign replaces and the
// virama removes. CONSONANTS holds the bare sound, so the inherent vowel is added as we go.
const ML_VOWELS = {
  അ: "a",
  ആ: "aa",
  ഇ: "i",
  ഈ: "ee",
  ഉ: "u",
  ഊ: "oo",
  ഋ: "ru",
  എ: "e",
  ഏ: "e",
  ഐ: "ai",
  ഒ: "o",
  ഓ: "o",
  ഔ: "au"
};
const ML_SIGNS = {
  "ാ": "aa",
  "ി": "i",
  "ീ": "ee",
  "ു": "u",
  "ൂ": "oo",
  "ൃ": "ru",
  "െ": "e",
  "േ": "e",
  "ൈ": "ai",
  "ൊ": "o",
  "ോ": "o",
  "ൌ": "au",
  "ൗ": "au"
};
const ML_CONSONANTS = {
  ക: "k",
  ഖ: "kh",
  ഗ: "g",
  ഘ: "gh",
  ങ: "ng",
  ച: "ch",
  ഛ: "chh",
  ജ: "j",
  ഝ: "jh",
  ഞ: "nj",
  ട: "t",
  ഠ: "th",
  ഡ: "d",
  ഢ: "dh",
  ണ: "n",
  ത: "th",
  ഥ: "th",
  ദ: "d",
  ധ: "dh",
  ന: "n",
  പ: "p",
  ഫ: "ph",
  ബ: "b",
  ഭ: "bh",
  മ: "m",
  യ: "y",
  ര: "r",
  ല: "l",
  വ: "v",
  ശ: "sh",
  ഷ: "sh",
  സ: "s",
  ഹ: "h",
  ള: "l",
  ഴ: "zh",
  റ: "r"
};
// chillu letters: a bare consonant with no inherent vowel
const ML_CHILLU = { "ൺ": "n", "ൻ": "n", "ർ": "r", "ൽ": "l", "ൾ": "l", "ൿ": "k" };
const ML_VIRAMA = "്";
const ML_ANUSVARA = "ം";
const ML_VISARGA = "ഃ";
const ML_ZWJ = /[‌‍]/;

function malayalam(text, i, out) {
  const ch = text[i];
  if (ML_CHILLU[ch]) { out.push(ML_CHILLU[ch]); return i + 1; }
  if (ch === ML_ANUSVARA) { out.push("m"); return i + 1; }
  if (ch === ML_VISARGA) { out.push("h"); return i + 1; }
  if (ML_VOWELS[ch]) { out.push(ML_VOWELS[ch]); return i + 1; }
  const base = ML_CONSONANTS[ch];
  if (!base) return -1;
  let j = i + 1;
  while (j < text.length && ML_ZWJ.test(text[j])) j++;
  const next = text[j];
  if (next === ML_VIRAMA) { out.push(base); return j + 1; }        // no vowel at all
  if (ML_SIGNS[next] !== undefined) { out.push(base + ML_SIGNS[next]); return j + 1; }
  out.push(base + "a");                                             // inherent vowel
  return i + 1;
}

/** Best-effort ASCII for a title. Characters from an unhandled script are dropped. */
export function translit(text) {
  const s = String(text || "");
  const out = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    const lower = ch.toLowerCase();
    if (CYRILLIC[lower] !== undefined) { out.push(CYRILLIC[lower]); i++; continue; }
    if (ch >= "ഀ" && ch <= "ൿ") {
      const next = malayalam(s, i, out);
      if (next > 0) { i = next; continue; }
      i++;
      continue;
    }
    out.push(ch);
    i++;
  }
  return out.join("");
}
