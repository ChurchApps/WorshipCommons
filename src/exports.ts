import { FLAT_KEYS, noteIndex, parseChordPro, splitKey, transposeChord } from "./chordpro.ts";
import { slidesFor, type Slide } from "./slides.ts";
import type { Song } from "./songs";
import { makeZip, type ZipEntry } from "./zip.ts";

/** One song as a projector / setlist wants it: the key it will be sung in and the sections picked. */
export interface ExportItem { song: Song; key?: string; order?: string[]; }
export interface ExportFile { name: string; type: string; body: string | Blob; }

/** Hand the browser a file to save. */
export function downloadFile(file: ExportFile) {
  const blob = file.body instanceof Blob ? file.body : new Blob([file.body], { type: file.type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
}

// ---- credits: what every export carries on its last slide or in its metadata ----

// ponytail: a two-line copy of licenses.ts#licenseNotice so this module stays importable under plain node
// (licenses.ts imports licenses.json at module top). The API sends `attribution` for every package, so this
// only fires for a song the API did not annotate; swap for a lazy import if the notice text ever drifts.
const fallbackNotice = (song: Song) => song.license === "PD" || !song.license
  ? "Public domain. Free for every use, including commercial."
  : `© ${song.year ?? ""} ${song.writer}. Licensed under ${song.license}${song.licenseVersion ? " " + song.licenseVersion : ""}${song.licenseUrl ? ": " + song.licenseUrl : ""}`.replace(/\s+/g, " ");

const LAYER_NAMES: Record<string, string> = { text: "Text", translation: "Translation", tune: "Tune", arrangement: "Arrangement", recording: "Recording", artwork: "Artwork" };

/** The attribution lines (attribution.txt minus its title line — the slide already names the song) and one row per rights layer. */
export function credits(song: Song): { attribution: string[]; layers: string[] } {
  const attribution = (song.attribution || fallbackNotice(song)).split(/\r?\n/).map(l => l.trim()).filter(l => l && l.toLowerCase() !== song.title.toLowerCase());
  const layers = Object.entries(song.rights || {}).filter(([, row]) => row?.license)
    .map(([layer, row]) => `${LAYER_NAMES[layer] || layer}: ${row!.license}${row!.holder ? " · " + row!.holder : ""}`);
  return { attribution, layers };
}

/** What the last slide of every export carries: attribution, then text / tune / arrangement: license. */
export const creditLines = (song: Song): string[] => { const c = credits(song); return [...c.attribution, ...c.layers]; };

/** File-name slug for every download the site builds. */
export const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") || "song";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const keyOf = (i: ExportItem) => i.key || i.song.songKey || "";
const bytes = (s: string) => new TextEncoder().encode(s);
const zipOf = (name: string, entries: ZipEntry[]): ExportFile => ({ name, type: "application/zip", body: makeZip(entries) });
const oneOrZip = (items: ExportItem[], ext: string, zipName: string, one: (i: ExportItem) => string): ExportFile => items.length === 1
  ? { name: `${slug(items[0].song.title)}${ext}`, type: "text/plain", body: one(items[0]) }
  : zipOf(zipName, items.map((i, n) => ({ name: `${String(n + 1).padStart(2, "0")}-${slug(i.song.title)}${ext}`, data: bytes(one(i)) })));

// ---- FreeShow ----
// A FreeShow `.show` file is the JSON tuple [id, Show] that FreeShow itself writes on export and reads under
// Import > FreeShow; one file per song, several songs → a zip of .show files (FreeShow imports many at once).
// `.project` bundles are not written: they wrap shows in a project tree FreeShow only reads from its own export.

const GROUPS: [RegExp, string][] = [[/pre.?chorus/i, "pre_chorus"], [/chorus|refrain/i, "chorus"], [/bridge/i, "bridge"], [/intro/i, "intro"], [/outro|ending|coda/i, "outro"], [/tag/i, "tag"], [/verse|stanza/i, "verse"]];
const globalGroup = (label: string) => GROUPS.find(([re]) => re.test(label))?.[1] || "verse";
const textItem = (lines: string[], style: string, fontSize: number) => ({
  type: "text",
  style,
  align: "",
  lines: lines.map(value => ({ align: "", text: [{ value, style: `font-size: ${fontSize}px;` }] }))
});

/** The subset of FreeShow's `Show` type (src/types/Show.ts) a lyrics-only show needs. */
export interface FreeShowShow {
  name: string; category: null | string;
  settings: { activeLayout: string; template: null | string };
  timestamps: { created: number; modified: null | number; used: null | number };
  meta: Record<string, string>;
  slides: Record<string, { group: string; color: null | string; globalGroup: string; settings: Record<string, never>; notes: string; items: unknown[] }>;
  layouts: Record<string, { name: string; notes: string; slides: { id: string }[] }>;
  media: Record<string, never>;
}

export function freeShowShow(item: ExportItem): readonly [string, FreeShowShow] {
  const { song } = item;
  const deck = slidesFor(song, item.order);
  const credit = creditLines(song);
  const slides: FreeShowShow["slides"] = {};
  const layout: { id: string }[] = [];
  deck.slides.forEach((s, n) => {
    const id = `${song.id}-s${n + 1}`;
    const items = [textItem(s.lines, "top:120px;left:50px;height:840px;width:1820px;", 100)];
    if (n === deck.slides.length - 1) items.push(textItem(credit, "top:960px;left:50px;height:100px;width:1820px;", 28));
    slides[id] = { group: s.label, color: null, globalGroup: globalGroup(s.label), settings: {}, notes: "", items };
    layout.push({ id });
  });
  const layoutId = `${song.id}-layout`;
  const show: FreeShowShow = {
    name: song.title,
    category: null,
    settings: { activeLayout: layoutId, template: null },
    timestamps: { created: Date.now(), modified: null, used: null },
    meta: { title: song.title, author: song.writer, copyright: credit.join(" · "), year: String(song.year ?? ""), key: keyOf(item), CCLI: "" },
    slides,
    layouts: { [layoutId]: { name: "Default", notes: "", slides: layout } },
    media: {}
  };
  return [song.id, show] as const;
}

export const exportFreeShow = (items: ExportItem[]): ExportFile => oneOrZip(items, ".show", "freeshow-shows.zip", i => JSON.stringify(freeShowShow(i)));

// ---- OpenLyrics 0.9 (OpenLP imports it directly) ----

const VERSE_KIND: [RegExp, string][] = [[/pre.?chorus/i, "p"], [/chorus|refrain/i, "c"], [/bridge/i, "b"], [/intro/i, "i"], [/outro|ending|coda|tag/i, "e"], [/verse|stanza/i, "v"]];
/** OpenLyrics verse names: Verse 1 → v1, Chorus → c, Bridge → b …; duplicates get a running number. */
export function verseNames(slides: Slide[]): Map<string, string> {
  const names = new Map<string, string>();
  const used = new Set<string>();
  for (const s of slides) {
    if (names.has(s.label)) continue;
    const kind = VERSE_KIND.find(([re]) => re.test(s.label))?.[1] || "o";
    const num = s.label.match(/\d+/)?.[0] || "";
    let name = kind + num;
    for (let n = 2; used.has(name); n++) name = kind + (num || "") + (num ? "-" : "") + n;
    used.add(name);
    names.set(s.label, name);
  }
  return names;
}

export function openLyricsXml(item: ExportItem): string {
  const { song } = item;
  const deck = slidesFor(song, item.order);
  const names = verseNames(deck.slides);
  const { attribution, layers } = credits(song);
  const seen = new Set<string>();
  const verses = deck.slides.filter(s => !seen.has(s.label) && seen.add(s.label))
    .map(s => `    <verse name="${names.get(s.label)}">\n      <lines>${s.lines.map(esc).join("<br/>")}</lines>\n    </verse>`);
  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<song xmlns=\"http://openlyrics.info/namespace/2009/song\" version=\"0.9\" createdIn=\"WorshipCommons\">",
    "  <properties>",
    `    <titles><title>${esc(song.title)}</title></titles>`,
    `    <authors><author>${esc(song.writer)}</author></authors>`,
    `    <copyright>${esc(attribution.join(" · "))}</copyright>`,
    keyOf(item) ? `    <key>${esc(keyOf(item))}</key>` : "",
    `    <verseOrder>${deck.slides.map(s => names.get(s.label)).join(" ")}</verseOrder>`,
    layers.length ? `    <comments>${layers.map(l => `<comment>${esc(l)}</comment>`).join("")}</comments>` : "",
    "  </properties>",
    "  <lyrics>",
    ...verses,
    "  </lyrics>",
    "</song>",
    ""
  ].filter(Boolean).join("\n");
}

export const exportOpenLyrics = (items: ExportItem[]): ExportFile => oneOrZip(items, ".xml", "openlyrics.zip", openLyricsXml);
/** OpenLP has no format of its own for import: it reads OpenLyrics XML (Songs → Import → OpenLyrics). */
export const exportOpenLP = (items: ExportItem[]): ExportFile => oneOrZip(items, ".openlp.xml", "openlp-songs.zip", openLyricsXml);

// ---- PPTX ----
// The smallest package PowerPoint, Keynote and LibreOffice all open: one blank layout on one master, a black
// background, one text box per slide. Every part below is referenced from [Content_Types].xml and its rels,
// and tools/exports.test.mjs checks that every referenced part exists.

const NS = "xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\" xmlns:p=\"http://schemas.openxmlformats.org/presentationml/2006/main\"";
const XML = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n";
const REL = (id: string, type: string, target: string) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`;
const rels = (body: string) => `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${body}</Relationships>`;
const EMPTY_TREE = "<p:nvGrpSpPr><p:cNvPr id=\"1\" name=\"\"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x=\"0\" y=\"0\"/><a:ext cx=\"0\" cy=\"0\"/><a:chOff x=\"0\" y=\"0\"/><a:chExt cx=\"0\" cy=\"0\"/></a:xfrm></p:grpSpPr>";
const CLR_MAP = "<p:clrMap bg1=\"dk1\" tx1=\"lt1\" bg2=\"dk2\" tx2=\"lt2\" accent1=\"accent1\" accent2=\"accent2\" accent3=\"accent3\" accent4=\"accent4\" accent5=\"accent5\" accent6=\"accent6\" hlink=\"hlink\" folHlink=\"folHlink\"/>";

const textBox = (id: number, name: string, y: number, h: number, lines: string[], size: number, color = "FFFFFF") =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>`
  + `<p:spPr><a:xfrm><a:off x="609600" y="${y}"/><a:ext cx="10972800" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>`
  + `<p:txBody><a:bodyPr wrap="square" anchor="ctr"><a:normAutofit/></a:bodyPr><a:lstStyle/>`
  + lines.map(l => `<a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" sz="${size}" dirty="0"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></a:rPr><a:t>${esc(l)}</a:t></a:r></a:p>`).join("")
  + "</p:txBody></p:sp>";

const slideXml = (lines: string[], credit?: string[]) => `${XML}<p:sld ${NS}><p:cSld><p:spTree>${EMPTY_TREE}`
  + textBox(2, "Lyrics", 609600, credit ? 4800600 : 5638800, lines, 4400)
  + (credit ? textBox(3, "Credit", 5562600, 990600, credit, 1400, "BBBBBB") : "")
  + "</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>";

const THEME = `${XML}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Projector"><a:themeElements>`
  + "<a:clrScheme name=\"Projector\"><a:dk1><a:srgbClr val=\"000000\"/></a:dk1><a:lt1><a:srgbClr val=\"FFFFFF\"/></a:lt1><a:dk2><a:srgbClr val=\"1F1F1F\"/></a:dk2><a:lt2><a:srgbClr val=\"EEEEEE\"/></a:lt2>"
  + ["4472C4", "ED7D31", "A5A5A5", "FFC000", "5B9BD5", "70AD47"].map((c, n) => `<a:accent${n + 1}><a:srgbClr val="${c}"/></a:accent${n + 1}>`).join("")
  + "<a:hlink><a:srgbClr val=\"0563C1\"/></a:hlink><a:folHlink><a:srgbClr val=\"954F72\"/></a:folHlink></a:clrScheme>"
  + "<a:fontScheme name=\"Projector\"><a:majorFont><a:latin typeface=\"Arial\"/><a:ea typeface=\"\"/><a:cs typeface=\"\"/></a:majorFont><a:minorFont><a:latin typeface=\"Arial\"/><a:ea typeface=\"\"/><a:cs typeface=\"\"/></a:minorFont></a:fontScheme>"
  + "<a:fmtScheme name=\"Projector\"><a:fillStyleLst><a:solidFill><a:schemeClr val=\"phClr\"/></a:solidFill><a:solidFill><a:schemeClr val=\"phClr\"/></a:solidFill><a:solidFill><a:schemeClr val=\"phClr\"/></a:solidFill></a:fillStyleLst>"
  + "<a:lnStyleLst><a:ln w=\"6350\"><a:solidFill><a:schemeClr val=\"phClr\"/></a:solidFill></a:ln><a:ln w=\"12700\"><a:solidFill><a:schemeClr val=\"phClr\"/></a:solidFill></a:ln><a:ln w=\"19050\"><a:solidFill><a:schemeClr val=\"phClr\"/></a:solidFill></a:ln></a:lnStyleLst>"
  + "<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>"
  + "<a:bgFillStyleLst><a:solidFill><a:schemeClr val=\"phClr\"/></a:solidFill><a:solidFill><a:schemeClr val=\"phClr\"/></a:solidFill><a:solidFill><a:schemeClr val=\"phClr\"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme>"
  + "</a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>";

const MASTER = `${XML}<p:sldMaster ${NS}><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="000000"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>${EMPTY_TREE}</p:spTree></p:cSld>${CLR_MAP}`
  + "<p:sldLayoutIdLst><p:sldLayoutId id=\"2147483649\" r:id=\"rId1\"/></p:sldLayoutIdLst>"
  + "<p:txStyles><p:titleStyle><a:lvl1pPr/></p:titleStyle><p:bodyStyle><a:lvl1pPr/></p:bodyStyle><p:otherStyle><a:lvl1pPr/></p:otherStyle></p:txStyles></p:sldMaster>";
const LAYOUT = `${XML}<p:sldLayout ${NS} type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>${EMPTY_TREE}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;

export function pptxParts(items: ExportItem[], when = new Date()): ZipEntry[] {
  const slides: string[] = [];
  for (const item of items) {
    const deck = slidesFor(item.song, item.order);
    const credit = creditLines(item.song);
    deck.slides.forEach((s, n) => slides.push(slideXml(s.lines, n === deck.slides.length - 1 ? credit : undefined)));
  }
  if (!slides.length) slides.push(slideXml([items[0]?.song.title || ""], items[0] ? creditLines(items[0].song) : []));
  const title = items.length === 1 ? items[0].song.title : `${items.length} songs`;
  const stamp = when.toISOString().replace(/\.\d+Z$/, "Z");
  const parts: [string, string][] = [
    [
      "[Content_Types].xml", `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
      + "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/>"
      + "<Override PartName=\"/ppt/presentation.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml\"/>"
      + "<Override PartName=\"/ppt/slideMasters/slideMaster1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml\"/>"
      + "<Override PartName=\"/ppt/slideLayouts/slideLayout1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml\"/>"
      + "<Override PartName=\"/ppt/theme/theme1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.theme+xml\"/>"
      + slides.map((_, n) => `<Override PartName="/ppt/slides/slide${n + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("")
      + "<Override PartName=\"/docProps/core.xml\" ContentType=\"application/vnd.openxmlformats-package.core-properties+xml\"/>"
      + "<Override PartName=\"/docProps/app.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.extended-properties+xml\"/></Types>"
    ],
    [
      "_rels/.rels", rels(REL("rId1", "officeDocument", "ppt/presentation.xml") + REL("rId3", "extended-properties", "docProps/app.xml")
      + "<Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties\" Target=\"docProps/core.xml\"/>")
    ],
    [
      "ppt/presentation.xml", `${XML}<p:presentation ${NS}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>`
      + `<p:sldIdLst>${slides.map((_, n) => `<p:sldId id="${256 + n}" r:id="rId${n + 3}"/>`).join("")}</p:sldIdLst>`
      + "<p:sldSz cx=\"12192000\" cy=\"6858000\"/><p:notesSz cx=\"6858000\" cy=\"9144000\"/><p:defaultTextStyle><a:defPPr><a:defRPr lang=\"en-US\"/></a:defPPr></p:defaultTextStyle></p:presentation>"
    ],
    [
      "ppt/_rels/presentation.xml.rels", rels(REL("rId1", "slideMaster", "slideMasters/slideMaster1.xml") + REL("rId2", "theme", "theme/theme1.xml")
      + slides.map((_, n) => REL(`rId${n + 3}`, "slide", `slides/slide${n + 1}.xml`)).join(""))
    ],
    ["ppt/slideMasters/slideMaster1.xml", MASTER],
    ["ppt/slideMasters/_rels/slideMaster1.xml.rels", rels(REL("rId1", "slideLayout", "../slideLayouts/slideLayout1.xml") + REL("rId2", "theme", "../theme/theme1.xml"))],
    ["ppt/slideLayouts/slideLayout1.xml", LAYOUT],
    ["ppt/slideLayouts/_rels/slideLayout1.xml.rels", rels(REL("rId1", "slideMaster", "../slideMasters/slideMaster1.xml"))],
    ["ppt/theme/theme1.xml", THEME],
    ...slides.flatMap((xml, n): [string, string][] => [[`ppt/slides/slide${n + 1}.xml`, xml], [`ppt/slides/_rels/slide${n + 1}.xml.rels`, rels(REL("rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"))]]),
    [
      "docProps/core.xml", `${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">`
      + `<dc:title>${esc(title)}</dc:title><dc:creator>WorshipCommons</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${stamp}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${stamp}</dcterms:modified></cp:coreProperties>`
    ],
    ["docProps/app.xml", `${XML}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>WorshipCommons</Application><Slides>${slides.length}</Slides></Properties>`]
  ];
  return parts.map(([name, xml]) => ({ name, data: bytes(xml) }));
}

export function exportPptx(items: ExportItem[]): ExportFile {
  const name = items.length === 1 ? `${slug(items[0].song.title)}.pptx` : "songs.pptx";
  return { name, type: "application/vnd.openxmlformats-officedocument.presentationml.presentation", body: makeZip(pptxParts(items)) };
}

// ---- OnSong / Planning Center paste: plain ChordPro, sections as "Label:" lines (what OnSong writes itself) ----

export function onSongText(item: ExportItem): string {
  const { song } = item;
  const from = splitKey(song.songKey || "C").root;
  const to = splitKey(keyOf(item) || from).root;
  const shift = (noteIndex(to) - noteIndex(from) + 12) % 12;
  const flats = FLAT_KEYS.has(to);
  const deck = slidesFor(song, item.order);
  const stanzas = new Map(parseChordPro(song.chordPro || "").map(st => [st.label.toLowerCase(), st]));
  const sections = deck.slides.map(s => {
    const st = stanzas.get(s.label.toLowerCase());
    const lines = st ? st.lines.map(l => l.map(seg => (seg.chord ? `[${shift ? transposeChord(seg.chord, shift, flats) : seg.chord}]` : "") + seg.text).join("")) : s.lines;
    return [`${s.label}:`, ...lines].join("\n");
  });
  const credit = creditLines(song);
  return [`{title: ${song.title}}`, `{artist: ${song.writer}}`, `{key: ${keyOf(item) || from}}`, ...credit.map(l => `{copyright: ${l}}`), "", ...sections.join("\n\n").split("\n")].join("\n").trimEnd() + "\n";
}

export const exportOnSongPaste = (items: ExportItem[]): ExportFile => ({ name: items.length === 1 ? `${slug(items[0].song.title)}.txt` : "songs.txt", type: "text/plain", body: items.map(onSongText).join("\n\n") });

// B1 Serving: no documented import file, so nothing is written for it here; the API serves the package it reads.
