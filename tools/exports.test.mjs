// The one runnable check for the projector exports: node --test tools/exports.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { creditLines, exportFreeShow, exportOnSongPaste, exportOpenLP, exportOpenLyrics, exportPptx, freeShowShow, openLyricsXml, onSongText } from "../src/exports.ts";

const chordPro = "Verse 1\n[G]Amazing [C]grace how [G]sweet\nThat saved a [D]wretch\n\nChorus\nPraise [D]Him\n\nVerse 2\nT'was [G]grace";
const song = {
  id: "ag1", title: "Amazing Grace", writer: "John Newton", year: 1779, songKey: "G", license: "PD", chordPro,
  attribution: "Amazing Grace\nJohn Newton, 1779\nPublic domain. Free for every use, including commercial.",
  rights: { text: { license: "PD" }, tune: { license: "CC-BY", holder: "A. Tune" }, arrangement: null },
  form: { status: "approved", sections: [], defaultOrder: ["Verse 1", "Chorus", "Verse 2", "Chorus"] }
};
const second = { ...song, id: "sn2", title: "Silent Night", writer: "Joseph Mohr", attribution: null, rights: null, form: null, chordPro: "Verse 1\nSilent night" };

// ---- a ~30 line store-only zip reader: central-directory names and the bytes of one entry ----
const bytesOf = async body => new Uint8Array(await body.arrayBuffer());
function zipEntries(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = buf.length - 22;
  while (dv.getUint32(eocd, true) !== 0x06054b50) eocd--;
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const entries = new Map();
  const dec = new TextDecoder();
  for (let i = 0; i < count; i++) {
    assert.equal(dv.getUint32(p, true), 0x02014b50, "central header");
    const size = dv.getUint32(p + 20, true);
    const n = dv.getUint16(p + 28, true), x = dv.getUint16(p + 30, true), c = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = dec.decode(buf.subarray(p + 46, p + 46 + n));
    const dataAt = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    entries.set(name, () => dec.decode(buf.subarray(dataAt, dataAt + size)));
    p += 46 + n + x + c;
  }
  return entries;
}
const balanced = xml => {
  const stack = [];
  for (const m of xml.matchAll(/<(\/?)([\w:.-]+)[^>]*?(\/?)>/g)) {
    if (m[3]) continue;
    if (m[1]) assert.equal(stack.pop(), m[2], `closing </${m[2]}>`);
    else stack.push(m[2]);
  }
  assert.deepEqual(stack, []);
};

test("credits: the attribution lines plus one row per rights layer", () => {
  assert.deepEqual(creditLines(song), ["John Newton, 1779", "Public domain. Free for every use, including commercial.", "Text: PD", "Tune: CC-BY · A. Tune"], "title line dropped, one row per layer, null layers skipped");
  assert.deepEqual(creditLines(second), ["Public domain. Free for every use, including commercial."]);
  assert.match(creditLines({ ...second, license: "CC-BY", licenseVersion: "4.0", licenseUrl: "https://x" })[0], /© 1779 Joseph Mohr\. Licensed under CC-BY 4\.0: https:\/\/x/);
});

test("FreeShow: a [id, show] tuple with one slide per section, the lines on it, the credit on the last", () => {
  const [id, show] = freeShowShow({ song });
  assert.equal(id, "ag1");
  const order = show.layouts[show.settings.activeLayout].slides.map(s => show.slides[s.id]);
  assert.deepEqual(order.map(s => s.group), ["Verse 1", "Chorus", "Verse 2", "Chorus"]);
  assert.deepEqual(order[0].items[0].lines.map(l => l.text[0].value), ["Amazing grace how sweet", "That saved a wretch"]);
  assert.equal(order[0].globalGroup, "verse");
  assert.equal(order[1].globalGroup, "chorus");
  assert.equal(order[0].items.length, 1);
  assert.match(order.at(-1).items[1].lines.map(l => l.text[0].value).join("\n"), /Tune: CC-BY/);
  assert.equal(show.meta.author, "John Newton");
  const file = exportFreeShow([{ song }]);
  assert.equal(file.name, "amazing-grace.show");
  assert.deepEqual(JSON.parse(file.body)[0], "ag1");
});

test("FreeShow / OpenLyrics: several songs become a zip of one file each", async () => {
  const zip = exportFreeShow([{ song }, { song: second }]);
  assert.equal(zip.name, "freeshow-shows.zip");
  assert.deepEqual([...zipEntries(await bytesOf(zip.body)).keys()], ["01-amazing-grace.show", "02-silent-night.show"]);
  const xmls = zipEntries(await bytesOf(exportOpenLyrics([{ song }, { song: second }]).body));
  assert.deepEqual([...xmls.keys()], ["01-amazing-grace.xml", "02-silent-night.xml"]);
  assert.match(xmls.get("02-silent-night.xml")(), /<title>Silent Night<\/title>/);
});

test("OpenLyrics: well-formed 0.9 XML whose verseOrder follows the form map; OpenLP gets the same writer", () => {
  const xml = openLyricsXml({ song, key: "A" });
  balanced(xml);
  assert.match(xml, /<song xmlns="http:\/\/openlyrics.info\/namespace\/2009\/song" version="0.9"/);
  assert.match(xml, /<verseOrder>v1 c v2 c<\/verseOrder>/);
  assert.match(xml, /<key>A<\/key>/);
  assert.match(xml, /<verse name="v1">\s*<lines>Amazing grace how sweet<br\/>That saved a wretch<\/lines>/);
  assert.equal((xml.match(/<verse /g) || []).length, 3, "the repeated chorus is one verse");
  assert.match(xml, /<copyright>John Newton, 1779 · Public domain\. Free for every use, including commercial\.<\/copyright>/);
  assert.match(xml, /<comment>Tune: CC-BY · A. Tune<\/comment>/);
  const picked = openLyricsXml({ song, order: ["Verse 2", "Chorus"] });
  assert.match(picked, /<verseOrder>v2 c<\/verseOrder>/);
  assert.match(openLyricsXml({ song: { ...song, title: "Rock & <Roll>" } }), /<title>Rock &amp; &lt;Roll&gt;<\/title>/);
  assert.equal(exportOpenLP([{ song }]).name, "amazing-grace.openlp.xml");
  assert.equal(exportOpenLP([{ song }]).body, exportOpenLyrics([{ song }]).body);
});

test("PPTX: every part referenced from [Content_Types].xml and the rels exists; one slide per section", async () => {
  const file = exportPptx([{ song }, { song: second }]);
  assert.equal(file.name, "songs.pptx");
  const entries = zipEntries(await bytesOf(file.body));
  const names = [...entries.keys()];
  assert.equal(names[0], "[Content_Types].xml");
  const types = entries.get("[Content_Types].xml")();
  for (const m of types.matchAll(/PartName="\/([^"]+)"/g)) assert.ok(entries.has(m[1]), `missing part ${m[1]}`);
  const relsOf = (relPath, base) => [...entries.get(relPath)().matchAll(/Target="([^"]+)"/g)].map(m => {
    const segs = [...base, ...m[1].split("/")];
    const out = [];
    for (const s of segs) s === ".." ? out.pop() : out.push(s);
    return out.join("/");
  });
  for (const t of relsOf("_rels/.rels", [])) assert.ok(entries.has(t), `root rel ${t}`);
  for (const t of relsOf("ppt/_rels/presentation.xml.rels", ["ppt"])) assert.ok(entries.has(t), `presentation rel ${t}`);
  for (const t of relsOf("ppt/slideMasters/_rels/slideMaster1.xml.rels", ["ppt", "slideMasters"])) assert.ok(entries.has(t), `master rel ${t}`);
  for (const t of relsOf("ppt/slides/_rels/slide1.xml.rels", ["ppt", "slides"])) assert.ok(entries.has(t), `slide rel ${t}`);
  for (const n of names.filter(n => n.endsWith(".xml") || n.endsWith(".rels"))) balanced(entries.get(n)());
  assert.deepEqual(names.filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).length, 5, "4 sections + 1");
  assert.match(entries.get("ppt/slides/slide1.xml")(), /<a:t>Amazing grace how sweet<\/a:t>/);
  assert.doesNotMatch(entries.get("ppt/slides/slide1.xml")(), /Credit/);
  assert.match(entries.get("ppt/slides/slide4.xml")(), /name="Credit"[\s\S]*Tune: CC-BY/);
  assert.match(entries.get("ppt/slides/slide5.xml")(), /Public domain/);
  assert.match(entries.get("ppt/presentation.xml")(), /(<p:sldId [^>]+>){5}/);
});

test("OnSong / Planning Center paste starts with {title:} and keeps chords, transposed to the chosen key", () => {
  const text = onSongText({ song });
  assert.ok(text.startsWith("{title: Amazing Grace}\n{artist: John Newton}\n{key: G}\n"));
  assert.match(text, /\{copyright: Tune: CC-BY · A. Tune\}/);
  assert.match(text, /\nVerse 1:\n\[G\]Amazing \[C\]grace how \[G\]sweet\n/);
  assert.match(text, /\nChorus:\nPraise \[D\]Him\n\nVerse 2:/);
  assert.match(onSongText({ song, key: "A" }), /\{key: A\}[\s\S]*\[A\]Amazing \[D\]grace/);
  assert.match(onSongText({ song, key: "F" }), /\[F\]Amazing \[Bb\]grace/);
  const both = exportOnSongPaste([{ song }, { song: second }]);
  assert.equal(both.name, "songs.txt");
  assert.match(both.body, /\{title: Silent Night\}/);
});
