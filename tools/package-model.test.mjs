// The one runnable check for the package-model helpers: node --test tools/package-model.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { composeMatrix, matrixForLicense, needsCcliReport, noDerivatives, rightsMatrixFor } from "../src/rights.ts";
import { slidesFor } from "../src/slides.ts";
import { chartShapes, rootAt, semitonesBetween } from "../src/chordpro.ts";

test("PD permits everything with no conditions", () => {
  const m = matrixForLicense("PD");
  for (const u of ["project", "print", "stream", "arrange", "record"]) assert.deepEqual(m[u], { allowed: true, conditions: [] });
});

test("CC BY-NC-SA: credit + non-commercial everywhere, share-alike on arrange and record", () => {
  const m = matrixForLicense("CC-BY-NC-SA");
  assert.equal(m.project.allowed, true);
  assert.deepEqual(m.print.conditions, ["Credit the writer and link the license", "Non-commercial use only"]);
  assert.ok(m.arrange.conditions.some(c => c.startsWith("Share alike")));
  assert.ok(m.record.conditions.some(c => c.startsWith("Share alike")));
});

test("ND forbids arranging but not recording; unknown licenses forbid everything", () => {
  assert.equal(matrixForLicense("CC-BY-ND").arrange.allowed, false);
  assert.equal(matrixForLicense("CC-BY-ND").record.allowed, true);
  assert.equal(matrixForLicense("ASCAP").print.allowed, false);
});

test("layers compose: PD text over a CC BY tune needs credit; a WC recording adds the stream condition", () => {
  const m = composeMatrix(["PD", "CC-BY", "WC"]);
  assert.equal(m.project.allowed, true);
  assert.deepEqual(m.project.conditions, ["Credit the writer and link the license"]);
  assert.equal(m.stream.conditions.length, 2);
  assert.equal(composeMatrix([]).print.allowed, false);
});

test("song helpers prefer what the API sent and fall back to the layers, then the asset license", () => {
  const pd = { license: "PD" };
  assert.equal(needsCcliReport(pd), false);
  assert.equal(noDerivatives(pd), false);
  const nd = { license: "PD", rights: { text: { license: "PD" }, tune: { license: "CC-BY-ND" } } };
  assert.equal(noDerivatives(nd), true);
  assert.equal(needsCcliReport({ license: "PD", ccliReport: true }), true);
  assert.equal(needsCcliReport({ license: "CCLI" }), true);
  const sent = { license: "PD", rightsMatrix: { project: { allowed: false, conditions: ["x"] } } };
  assert.equal(rightsMatrixFor(sent).project.allowed, false);
});

test("slides follow the form map order, strip chords, and fall back to written order", () => {
  const chordPro = "Verse 1\n[G]Amazing [C]grace how [G]sweet\n\nChorus\nPraise [D]Him\n\nVerse 2\nT'was [G]grace";
  const deck = slidesFor({ title: "T", chordPro, form: { sections: [], defaultOrder: ["Verse 1", "Chorus", "Verse 2", "Chorus"] } });
  assert.deepEqual(deck.slides.map(s => s.label), ["Verse 1", "Chorus", "Verse 2", "Chorus"]);
  assert.deepEqual(deck.slides[0].lines, ["Amazing grace how sweet"]);
  assert.deepEqual(slidesFor({ title: "T", chordPro }).slides.map(s => s.label), ["Verse 1", "Chorus", "Verse 2"]);
  assert.deepEqual(slidesFor({ title: "T", chordPro }, ["Chorus"]).slides.map(s => s.label), ["Chorus"]);
});

test("chartShapes, rootAt, and semitonesBetween agree on one key arithmetic", () => {
  const s = chartShapes({ songKey: "G" }, "A", 2);
  assert.deepEqual([s.keyLabel, s.shapeLabel, s.shift, s.dispShift, s.useFlats], ["A", "G", 2, 0, false]);
  assert.equal(chartShapes({ songKey: "Em" }, "F#m", 0).keyLabel, "F#m");
  assert.equal(rootAt("C", 1), "Db");
  assert.equal(rootAt("C", -1), "B");
  assert.equal(semitonesBetween("C", "G"), -5);
  assert.equal(semitonesBetween("C", "F"), 5);
});
