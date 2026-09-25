import { useState } from "react";
import { Link } from "react-router-dom";
import { Song, canLead, extraFilesOf, fileUrl, recordingUrlOf, songPath } from "../songs";
import { INPUTS, OUTPUTS, InputId, Output, isPassthrough, unmet } from "../pipeline";
import { useI18n } from "../i18n";

const inSources = (url?: string) => !!url && /\/(sources|masters)\//.test(url);

function inputsOf(song: Song): Set<InputId> {
  const midi = song.midiUrl || fileUrl(song, "midi");
  const has: Record<InputId, unknown> = {
    words: song.chordPro,
    chords: song.hasChords ?? /\[[A-G]/.test(song.chordPro || ""),
    abc: song.abcUrl,
    musicxml: inSources(song.scoreUrl),
    tuneMid: inSources(midi),
    sheetPdf: song.sheetPdfUrl,
    timing: song.hasTiming || song.lyricsUrl,
    recording: song.masterUrl || recordingUrlOf(song),
    // a demo rides on the composition's license, so rights.recording alone is no grant: a master must be on file
    // (its file, or the stems pack a granted master built — harvested masters are keyed as the demo)
    recordingGrant: song.rights?.recording && (song.masterUrl || song.stemsZipUrl),
    video: song.videoUrl,
    cover: song.artUrl,
    extras: extraFilesOf(song).length
  };
  return new Set(INPUTS.map(([id]) => id).filter(id => has[id]));
}

function outputsOf(song: Song, have: Set<InputId>): Set<string> {
  const midi = song.midiUrl || fileUrl(song, "midi");
  const built: Record<string, unknown> = {
    lyrics: have.has("words"),
    chords: have.has("words") && have.has("chords"),
    compositionZip: song.compositionZipUrl,
    sheet: song.abcUrl,
    sheetPdf: song.sheetPdfUrl,
    score: song.scoreUrl || (midi && !inSources(midi)),
    playback: midi,
    lead: canLead(song),
    highlight: have.has("words") && have.has("timing"),
    listen: have.has("recording"),
    packs: song.audioZipUrl || song.stemsZipUrl,
    video: song.videoUrl,
    cover: song.artUrl,
    extras: have.has("extras")
  };
  return new Set(OUTPUTS.map(o => o.id).filter(id => built[id]));
}

const ROW = 36; // px per node, matched in song.css; wires are drawn from row indexes, so nothing is measured
// Rows: the many-to-many part on top with its shorter source column centred, then the as-given files
// (sheet PDF, video, cover, extras), each sharing a row with its one output so the wire is a straight line.
const PASSED = OUTPUTS.filter(isPassthrough);
const FLOW_OUT = OUTPUTS.filter(o => !isPassthrough(o));
const FLOW_IN = INPUTS.filter(([id]) => FLOW_OUT.some(o => o.needs.flat().includes(id)));
const INPUT_TOP = Math.floor((FLOW_OUT.length - FLOW_IN.length) / 2);
const OUT_ROWS = [...FLOW_OUT, ...PASSED];
const IN_ROW = new Map<InputId, number>([...FLOW_IN.map(([id], i) => [id, INPUT_TOP + i] as [InputId, number]), ...PASSED.map((o, i) => [o.needs[0][0], FLOW_OUT.length + i] as [InputId, number])]);
const IN_ROWS = Array.from({ length: OUT_ROWS.length }, (_, row) => INPUTS.find(([id]) => IN_ROW.get(id) === row)); // centre the shorter column, in rows

// The pipeline for one song as a wiring diagram: sources on the left, outputs on the right, a wire per dependency.
export default function SourcesPanel({ song }: { song: Song }) {
  const { t } = useI18n();
  const [active, setActive] = useState("");
  const have = inputsOf(song);
  const built = outputsOf(song, have);
  const label = Object.fromEntries(INPUTS) as Record<InputId, string>;
  const stateOf = (o: Output) => built.has(o.id) ? "have" : unmet(o, have).length ? "missing" : "ready";

  // an either-or need draws only the sources we hold, or the preferred one when we hold none; the caption spells out the "or"
  const preferred = (o: Output) => o.needs.flatMap(group => group.some(id => have.has(id)) ? group.filter(id => have.has(id)) : group.slice(0, 1));
  // ...and no source is left dangling: one that lost every wire to a preferred alternative keeps its shortest
  const orphan = (id: InputId) => !OUT_ROWS.some(o => preferred(o).includes(id));
  const nearest = (id: InputId) => OUT_ROWS.filter(o => o.needs.flat().includes(id)).sort((a, b) => Math.abs(OUT_ROWS.indexOf(a) - IN_ROW.get(id)!) - Math.abs(OUT_ROWS.indexOf(b) - IN_ROW.get(id)!))[0];
  const drawn = (o: Output) => [...preferred(o), ...INPUTS.map(([id]) => id).filter(id => orphan(id) && nearest(id) === o)];
  const wires = OUT_ROWS.flatMap((o, oi) => drawn(o).map(id => ({
    id,
    out: `out:${o.id}`,
    label: o.label,
    y1: ((IN_ROW.get(id) ?? 0) + 0.5) * ROW,
    y2: (oi + 0.5) * ROW,
    // a wire is about its source: solid when we hold it, dashed when we do not; the output node carries its own state
    state: !have.has(id) ? "missing" : stateOf(o) === "ready" ? "ready" : "have"
  })));
  const lit = (node: string) => !active || node === active || wires.some(w => (w.id === active && w.out === node) || (w.out === active && w.id === node));
  const trace = (node: string) => ({ onMouseEnter: () => setActive(node), onMouseLeave: () => setActive(""), onFocus: () => setActive(node), onBlur: () => setActive(""), onClick: () => setActive(node) });

  const needsText = (o: Output) => o.needs.map(group => group.map(id => `${t(label[id])} ${have.has(id) ? "✓" : "✗"}`).join(` ${t("or")} `)).join("  +  ");
  const stateText = { have: t("available"), ready: t("ready to build"), missing: t("not yet") };
  const activeOut = OUTPUTS.find(o => `out:${o.id}` === active);
  const activeIn = INPUTS.find(([id]) => id === active);
  const caption = activeOut
    ? `${t(activeOut.label)} — ${stateText[stateOf(activeOut)]}. ${t("Needs")}: ${needsText(activeOut)}`
    : activeIn
      ? `${t(activeIn[1])} — ${have.has(activeIn[0]) ? t("on file") : t("not yet")}. ${have.has(activeIn[0]) ? t("Feeds") : t("Would feed")}: ${wires.filter(w => w.id === activeIn[0]).map(w => t(w.label)).join(" · ")}`
      : t("Point at a source or an output to trace it.");

  return (
    <section data-testid="sources-panel">
      <h2>{t("Sources & outputs")}</h2>
      <div className="io-flow">
        <div className="io-col" data-testid="io-inputs">
          <p className="io-head">{t("Sources")}</p>
          {IN_ROWS.map((input, row) => {
            if (!input) return <div key={row} className="io-gap" />;
            const [id, name] = input;
            return (
              <button key={id} type="button" className={"io-node " + (have.has(id) ? "have" : "missing") + (lit(id) ? "" : " dim")} data-testid={`io-input-${id}`} data-have={have.has(id) ? "true" : "false"} title={t(name)} {...trace(id)}>
                <span>{t(name)}</span><i aria-hidden="true" />
              </button>
            );
          })}
        </div>
        <svg className="io-wires" style={{ height: OUT_ROWS.length * ROW }} viewBox={`0 0 100 ${OUT_ROWS.length * ROW}`} preserveAspectRatio="none" aria-hidden="true">
          {wires.map(w => (
            <path key={w.id + w.out} className={w.state + (!active || w.id === active || w.out === active ? "" : " dim")} d={`M0,${w.y1} C50,${w.y1} 50,${w.y2} 100,${w.y2}`} />
          ))}
        </svg>
        <div className="io-col out" data-testid="io-outputs">
          <p className="io-head">{t("Outputs")}</p>
          {OUT_ROWS.map(o => (
            <button key={o.id} type="button" className={"io-node " + stateOf(o) + (lit(`out:${o.id}`) ? "" : " dim")} data-testid={`io-output-${o.id}`} data-state={stateOf(o)} title={`${t(o.label)} — ${needsText(o)}`} {...trace(`out:${o.id}`)}>
              <i aria-hidden="true" /><span>{t(o.label)}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="io-caption" aria-live="polite" data-testid="io-caption">{caption}</p>
      <p className="io-legend"><span className="have">{t("Have it")}</span><span className="ready">{t("Ready to build")}</span><span className="missing">{t("Missing")}</span></p>
      <p className="rel-hint">{t("Have one of the missing sources?")} <Link to={`${songPath(song)}/edit`}>{t("Add it to this song →")}</Link></p>
    </section>
  );
}
