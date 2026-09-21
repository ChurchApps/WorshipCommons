import { test } from "node:test";
import assert from "node:assert/strict";
import { folderSlug, idOf, songPath } from "../src/slug.mjs";

test("latin titles are untouched by transliteration", () => {
  assert.equal(folderSlug("Amazing Grace"), "amazing-grace");
  assert.equal(folderSlug("Nun Ruhen Alle Wälder"), "nun-ruhen-alle-wälder");
  assert.equal(folderSlug("Cúmplase, Oh Cristo, Tu Voluntad"), "cúmplase-oh-cristo-tu-voluntad");
});

test("cyrillic transliterates instead of collapsing to untitled", () => {
  assert.equal(folderSlug("Я возлюбил"), "ya-vozlyubil");
  assert.equal(folderSlug("Больше, чем скромный Младенец"), "bolshe-chem-skromnyy-mladenets");
});

test("malayalam transliterates, honouring vowel signs, virama and chillu", () => {
  assert.equal(folderSlug("കേൾക്ക ദൂത സൽസ്വരം"), "kelkka-dootha-salsvaram");
  assert.equal(folderSlug("എൻ യേശു എൻ പ്രിയൻ എൻ"), "en-yeshu-en-priyan-en");
});

test("a script we cannot transliterate falls back to the language, not untitled", () => {
  assert.equal(folderSlug("我的全心", "Chinese"), "chinese");
  assert.equal(folderSlug("我的全心"), "untitled");
});

test("songPath keeps ids peelable whatever the script", () => {
  for (const song of [
    { title: "Amazing Grace", language: "English", id: "YxPfAFYWOaG" },
    { title: "Я возлюбил", language: "Russian", id: "Rl0szVVrR4q" },
    { title: "കേൾക്ക ദൂത സൽസ്വരം", language: "Malayalam", id: "--444poRqpG" },
    { title: "我的全心", language: "Chinese", id: "RMpnMt90e_O" }
  ]) {
    const path = songPath(song);
    const last = path.split("/").pop();
    assert.equal(idOf(last), song.id, path);
    // the slug half carries no uppercase, whitespace or leftover non-Latin
    assert.match(last.slice(0, -(song.id.length + 1)), /^[a-z0-9À-ɏ-]+$/, path);
  }
});
