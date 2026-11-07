// node --test tools/credits.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { parseCredit, personName, personKey, personId, personPath, catalogPersons, creditParts } from "../src/credits.mjs";
import { idOf } from "../src/slug.mjs";

test("credits split into people and roles", () => {
  assert.deepEqual(parseCredit("Fanny Crosby & John Sweney"), [{ name: "Fanny Crosby", role: "writer" }, { name: "John Sweney", role: "writer" }]);
  assert.deepEqual(parseCredit("Elton Smith / Larry Holder / Steve Israel").map(p => p.name), ["Elton Smith", "Larry Holder", "Steve Israel"]);
  assert.deepEqual(parseCredit("Elton Smith, Larry Holder and Sylvain Turcotte").map(p => p.name), ["Elton Smith", "Larry Holder", "Sylvain Turcotte"]);
  assert.deepEqual(parseCredit("Isaac Watts · tr. Jan Foss"), [{ name: "Isaac Watts", role: "writer" }, { name: "Jan Foss", role: "translator" }]);
  assert.deepEqual(parseCredit("R. Keen · arr. Peter Chubb"), [{ name: "R. Keen", role: "writer" }, { name: "Peter Chubb", role: "arranger" }]);
  assert.deepEqual(parseCredit("Siegfried August Mahlmann · tr. Charles Timothy Brooks & John Sullivan Dwight").map(p => p.role), ["writer", "translator", "translator"]);
  assert.deepEqual(parseCredit("Words by Joy Marquéz • Music by Doug Gregan").map(p => p.name), ["Joy Marquéz", "Doug Gregan"]);
  assert.deepEqual(parseCredit("Henry J. Gauntlett, Jr.").map(p => p.name), ["Henry J. Gauntlett, Jr."]);
});

test("collective credits, tunes, and places are not people", () => {
  for (const credit of [
    "Traditional", "Anonymous", "Anónimo", "African American spiritual", "Irish, 8th c. · tr. Byrne", "Traditional · Assam, India", "Scottish Psalter · Crimond", "composite", "Latin hymn", "1777 from Landshuter Gesangbuch"
  ]) {
    assert.deepEqual(parseCredit(credit), [], credit);
  }
  assert.deepEqual(parseCredit("William C. Dix · Greensleeves").map(p => p.name), ["William C. Dix"]);
  assert.equal(personName("Charlemagne"), null);
  assert.equal(personName("Ambrose of Milan"), "Ambrose of Milan");
});

test("spellings of one person share a key and an id", () => {
  assert.equal(personKey("Fanny J. Crosby"), personKey("Fanny Crosby"));
  assert.equal(personId("Frances Ridley Havergal"), personId("Frances Havergal"));
  assert.equal(personId("Théodore de Bèze"), personId("Theodore de Beze"));
  assert.notEqual(personId("Charles Wesley"), personId("John Wesley"));
});

test("person ids are stable, 11 url-safe characters, and survive idOf", () => {
  const id = personId("Charles Wesley");
  assert.match(id, /^[A-Za-z0-9_-]{11}$/);
  assert.equal(personId("Charles Wesley"), id);
  const p = personPath("John Mason Neale");
  assert.equal(idOf(p.replace("/writers/", "")), personId("John Mason Neale"));
});

test("catalog persons gather every credit and index people with two songs", () => {
  const songs = [
    { id: "a0000000001", title: "B", writer: "Fanny Crosby & John Sweney" },
    { id: "a0000000002", title: "A", writer: "Fanny J. Crosby" },
    { id: "a0000000003", title: "C", writer: "Fanny Crosby · tr. Jan Foss" },
    { id: "a0000000004", title: "D", writer: "Traditional" }
  ];
  const persons = catalogPersons(songs);
  const fanny = persons.find(p => p.id === personId("Fanny Crosby"));
  assert.equal(fanny.name, "Fanny Crosby"); // most common spelling
  assert.deepEqual(fanny.songs.map(s => s.song.title), ["A", "B", "C"]);
  assert.equal(fanny.indexable, true);
  assert.equal(persons.find(p => p.name === "Jan Foss").songs[0].role, "translator");
  assert.equal(persons.find(p => p.name === "John Sweney").indexable, false);
  assert.equal(persons.length, 3);
});

test("credit parts keep the text as written and link people in place", () => {
  const persons = catalogPersons([{ id: "x", writer: "Fanny J. Crosby & William Doane" }, { id: "y", writer: "Fanny Crosby" }]);
  const parts = creditParts("Fanny J. Crosby & William Doane · tr. Jan Foss", persons);
  assert.equal(parts.map(p => p.text).join(""), "Fanny J. Crosby & William Doane · tr. Jan Foss");
  assert.deepEqual(parts.filter(p => p.person).map(p => p.text), ["Fanny J. Crosby", "William Doane", "Jan Foss"]);
  // the catalog's page for Fanny, whatever spelling this credit uses
  assert.equal(parts[0].person.path, persons.find(p => p.id === personId("Fanny Crosby")).path);
  assert.deepEqual(creditParts("Traditional", persons), [{ text: "Traditional" }]);
});
