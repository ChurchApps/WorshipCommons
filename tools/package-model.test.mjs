// The one runnable check for the package-model helpers: node --test tools/package-model.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { composeMatrix, matrixForLicense, needsCcliReport, rightsMatrixFor } from "../src/rights.ts";
import { isModernWorship } from "../src/era.ts";
import { sectionsFor, slidesFor } from "../src/slides.ts";
import { chartShapes, parseChordPro, rootAt, sectionLabel, semitonesBetween, unparen } from "../src/chordpro.ts";
import { passageQueries } from "../src/bible.ts";

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

test("custom Larry Holder grant: church uses allowed, CCLI not required, translation flagged on arrange", () => {
  const m = matrixForLicense("larry-holder");
  assert.equal(m.print.allowed, true);
  assert.equal(m.stream.allowed, true);
  assert.ok(m.print.conditions.some(c => /credit/i.test(c)));
  assert.ok(m.arrange.conditions.some(c => /translation/i.test(c)));
  assert.equal(needsCcliReport({ license: "larry-holder" }), false);
  assert.equal(needsCcliReport({ license: "larry-holder", ccliReport: true }), false);
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

test("blank-line ChordPro keeps the first line as the stanza label", () => {
  const s = parseChordPro("Verse 1\n[G]Amazing [C]grace\n\nChorus\nPraise [D]Him");
  assert.deepEqual(s.map(x => x.label), ["Verse 1", "Chorus"]);
  assert.equal(s[0].lines.length, 1);
  assert.equal(s[1].lines.length, 1);
});

test("double-spaced lyrics fold onto section headings instead of one stanza per line", () => {
  const s = parseChordPro(">Lyrics\n\nIntroduction\n\n(Mary sings verse 1)\n\nFor the wonder of God's love,\n\nBridge\n\nTo the least of all His servants,");
  assert.deepEqual(s.map(x => x.label), ["Introduction", "Bridge"]);
  assert.deepEqual(s[0].lines.map(l => l.map(g => g.text).join("")), ["(Mary sings verse 1)", "For the wonder of God's love,"]);
  assert.equal(s[1].lines.length, 1);
});

test("double-spaced lyrics with no headings become one Lyrics stanza", () => {
  const s = parseChordPro("{title: X}\n\nAmazing grace\n\nhow sweet the sound");
  assert.equal(s.length, 1);
  assert.equal(s[0].label, "Lyrics");
  assert.equal(s[0].lines.length, 2);
});

// "By Our Side" as its writer sent it: parenthesised labels, chord-only intro lines, and a bridge whose lyrics start a new block
const byOurSide = "(Intro)\n[A / Bm / G / | A / Bm / G]\n\n(Verse 1)\n[A] We won't [Bm] go, if You're not [G] with [A] us\n\n(Chorus x2)\n[G] Your [D]love is [A]constant\n\n(Bridge)\n[G / D / A / Bm | G / D / A]\n\n[G]When the [D]music [A]fades   Still [Bm]by our side\n[G]When we [D]lose our [A]way\n\n(Intro/Instrumental)\n\n(PreChorus)\n[Asus] You've given [Gsus]everything I need";
const text = line => line.map(g => g.text).join("").trim();

test("sectionLabel reads bare and parenthesised labels, never a sung line", () => {
  const labels = {
    "(Verse 1)": "Verse 1",
    "(Chorus x2)": "Chorus x2",
    "(Intro/Instrumental)": "Intro/Instrumental",
    "( Turnaround )": "Turnaround",
    "Verse 1": "Verse 1",
    "Chorus": "Chorus",
    "Pre-Chorus": "Pre-Chorus",
    "Verse 2:": "Verse 2:",
    "Chorus Two": "Chorus Two"
  };
  for (const [line, label] of Object.entries(labels)) assert.equal(sectionLabel(line), label, line);
  for (const line of ["[G]When the [D]music [A]fades", "([G]Repeat)", "[A / Bm / G]", "Amazing grace how sweet the sound", "Chorus of angels sing"]) assert.equal(sectionLabel(line), null, line);
  assert.equal(unparen(" (Chorus x2) "), "Chorus x2");
  assert.equal(unparen("Verse 1"), "Verse 1");
});

test("parenthesised labels label their stanzas and a lyric-first block keeps its first line", () => {
  const s = parseChordPro(byOurSide);
  assert.deepEqual(s.map(x => x.label), ["Intro", "Verse 1", "Chorus x2", "Bridge", "Intro/Instrumental", "PreChorus"]);
  assert.equal(text(s[1].lines[0]), "We won't  go, if You're not  with  us");
  assert.deepEqual(s[3].lines.map(text), ["", "When the music fades   Still by our side", "When we lose our way"]);
  assert.equal(s[4].lines.length, 0);
  assert.equal(slidesFor({ title: "T", chordPro: byOurSide }).slides[0].lines.length, 0, "a chord-only intro projects no blank line");
  // the submit form's "first sung line" skips (Intro) and its chord line
  assert.equal(s.flatMap(st => st.lines).map(text).find(Boolean), "We won't  go, if You're not  with  us");
});

test("a label with only chords takes the unlabelled lyric block after it (By Our Side's bridge)", () => {
  const bridge = "(Bridge)\n[G / D / A / Bm | G / D / A]\n\n[G]When the [D]music [A]fades   Still [Bm]by our side\n[G]When we [D]lose our [A]way   Still [Bm]by our side\n[G] You [D]delight to [A]be   [Bm]By our side   By our [A]side\n[G]When we've [D]lost our [A]song   Still [Bm]by our side\n[G]When our [D]strength is [A]gone   Still [Bm]by our side\n[G] You are [D]always [A]faithful   [Bm]By our [G]side   By our [A]side\n\n(Chorus x2)\n[G] Your [D]love is [A]constant";
  const s = parseChordPro(bridge);
  assert.deepEqual(s.map(x => x.label), ["Bridge", "Chorus x2"]);
  assert.equal(s[0].lines.map(text).filter(Boolean).length, 6);
  assert.equal(text(s[0].lines[1]), "When the music fades   Still by our side");
});

test("an unlabelled lyric block after a sung stanza stands on its own", () => {
  const s = parseChordPro("Verse 1\n[G]Amazing grace\n\n[C]Through many dangers\ntoils and snares");
  assert.deepEqual(s.map(x => x.label), ["Verse 1", ""]);
  assert.deepEqual(s[1].lines.map(text), ["Through many dangers", "toils and snares"]);
});

test("form labels match stanza labels with or without parentheses", () => {
  const plain = "Verse 1\n[G]Amazing grace\n\nChorus x2\nPraise [D]Him";
  assert.deepEqual(sectionsFor({ chordPro: plain, form: { sections: [], defaultOrder: ["(Chorus x2)", "(Verse 1)"] } }).map(x => x.label), ["Chorus x2", "Verse 1"]);
  assert.deepEqual(sectionsFor({ chordPro: byOurSide, form: { sections: [], defaultOrder: ["Verse 1", "Bridge"] } }).map(x => x.label), ["Verse 1", "Bridge"]);
  assert.deepEqual(sectionsFor({ chordPro: byOurSide }, ["(verse 1)"]).map(x => x.label), ["Verse 1"]);
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

test("modern worship is an era, not a license: CC, PD, and WC after 1970 all count", () => {
  assert.equal(isModernWorship({ year: 2008, license: "PD" }), true);
  assert.equal(isModernWorship({ year: 2009, license: "CC-BY" }), true);
  assert.equal(isModernWorship({ year: 2024, license: "WC" }), true);
  assert.equal(isModernWorship({ year: 1997, license: "larry-holder" }), true);
  assert.equal(isModernWorship({ year: 1779, license: "PD" }), false);
});

test("scripture references: any dash is a hyphen, a list splits at each new book, a verse list stays whole", () => {
  assert.deepEqual(passageQueries("Romans 8:15–16"), ["Romans 8:15-16"]);
  assert.deepEqual(passageQueries("Psalm 91:4, Isaiah 43:2"), ["Psalm 91:4", "Isaiah 43:2"]);
  assert.deepEqual(passageQueries("John 3:16,18; 1 John 4:8"), ["John 3:16,18", "1 John 4:8"]);
  assert.deepEqual(passageQueries("Hébreux 10,22–23"), ["Hébreux 10,22-23"]);
});
