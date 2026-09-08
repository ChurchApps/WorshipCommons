import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { loadSong, Song } from "../songs";
import { parseChordPro, transposeChord, splitKey, noteIndex, FLAT_KEYS, SHARP, FLAT } from "../chordpro";
import { usePageMeta } from "../seo";
import { useI18n } from "../i18n";
import { noDerivatives } from "../rights";
import { attributionFor, LAYER_LABEL, layerLines } from "../licenses";

// the fourth size is for the music stand and the back pew: ≥ 22px body text
const SIZES: [number, string, string][] = [[14, "Small", "print-size-14"], [16, "Medium", "print-size-16"], [19, "Large", "print-size-19"], [22, "Large print", "print-large"]];

export default function PrintChart() {
  const { t } = useI18n();
  const { id } = useParams();
  const [params] = useSearchParams();
  const [song, setSong] = useState<Song | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [size, setSize] = useState(16);
  const [cols, setCols] = useState(1);
  const [chords, setChords] = useState(params.get("chords") !== "0");
  useEffect(() => {
    if (id) loadSong(id).then(s => { s ? setSong(s) : setNotFound(true); });
  }, [id]);
  const stanzas = useMemo(() => song?.chordPro ? parseChordPro(song.chordPro) : [], [song]);
  usePageMeta(song ? t("{title} — chord chart | WorshipCommons", { title: song.title }) : "WorshipCommons");

  if (notFound) return <main style={{ padding: 40 }}>{t("Song not found.")} <Link to="/songs">{t("← All songs")}</Link></main>;
  if (!song) return <main style={{ padding: 40 }}>{t("Loading…")}</main>;

  const { root: origRoot, suffix: keySuffix } = splitKey(song.songKey);
  // the ND switch reaches the print page too: a transposed or capoed chart is a derivative
  const nd = noDerivatives(song);
  const { root: selRoot } = splitKey(nd ? song.songKey : (params.get("key") || song.songKey));
  const capo = nd ? 0 : Math.min(11, Math.max(0, Number(params.get("capo")) || 0));
  const layers = layerLines(song);
  const shift = (noteIndex(selRoot) - noteIndex(origRoot) + 12) % 12;
  const shapeIdx = (noteIndex(selRoot) - capo + 12) % 12;
  const shapeRoot = FLAT_KEYS.has(FLAT[shapeIdx]) ? FLAT[shapeIdx] : SHARP[shapeIdx];
  const useFlats = FLAT_KEYS.has(shapeRoot);
  const dispShift = (shift - capo + 12) % 12;
  const keyLabel = selRoot + keySuffix;

  return (
    <main style={{ maxWidth: cols === 2 ? 1000 : 700, margin: "0 auto", padding: "40px 24px", fontFamily: "Georgia, serif", fontSize: size }}>
      <style>{`
        .print-chord { display: block; font-family: monospace; font-weight: 700; min-height: 1.1em; }
        .print-seg { display: inline-block; vertical-align: bottom; white-space: pre-wrap; }
        .print-stanza { break-inside: avoid; }
        .no-print { margin-bottom: 24px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
        @media print { .no-print { display: none; } }
      `}</style>
      <div className="no-print">
        <button onClick={() => window.print()} style={{ padding: "8px 20px", cursor: "pointer" }}>{t("Print")}</button>
        {/* radios, not buttons: "Large print" must never share an accessible name with the Print button */}
        <span role="radiogroup" aria-label={t("Text size")} style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
          {t("Text size")}
          {SIZES.map(([px, label, testid]) => (
            <label key={px} style={{ fontWeight: size === px ? 700 : 400 }}><input type="radio" name="print-size" data-testid={testid} checked={size === px} onChange={() => setSize(px)} /> {t(label)}</label>
          ))}
        </span>
        <label><input type="checkbox" checked={cols === 2} onChange={e => setCols(e.target.checked ? 2 : 1)} /> {t("2 columns")}</label>
        <label><input type="checkbox" data-testid="print-chords" checked={chords} onChange={e => setChords(e.target.checked)} /> {t("Show chords")}</label>
        <Link to={`/songs/${song.id}`}>{t("← Back to song")}</Link>
      </div>
      <h1 style={{ marginBottom: 4 }}>{song.title}</h1>
      <p style={{ marginBottom: 24 }}>{song.writer} · {t("Key of {key}", { key: keyLabel })}{capo ? ` · ${t("Capo {n} — {root} shapes", { n: capo, root: shapeRoot + keySuffix })}` : ""} · {song.bpm} BPM · {song.timeSignature}</p>
      <div style={cols === 2 ? { columns: 2, columnGap: 48 } : undefined}>
        {stanzas.map((stanza, si) => (
          <section className="print-stanza" key={si} style={{ marginBottom: 24 }}>
            <p style={{ fontWeight: 700, textTransform: "uppercase", fontSize: "0.8125em", letterSpacing: 1 }}>{stanza.label}</p>
            {stanza.lines.map((segments, li) => (
              <p key={li} style={{ margin: "0 0 6px" }}>
                {segments.map((seg, gi) => (
                  <span className="print-seg" key={gi}>
                    {chords && <span className="print-chord">{seg.chord ? transposeChord(seg.chord, dispShift, useFlats) : " "}</span>}
                    <span>{seg.text || " "}</span>
                  </span>
                ))}
              </p>
            ))}
          </section>
        ))}
      </div>
      <div style={{ marginTop: 32, fontSize: 13, color: "#555" }} data-testid="print-footer">
        {/* the attribution line: for CC songs the credit + license + link is a condition of the grant, so it prints on every chart */}
        <p style={{ whiteSpace: "pre-line" }}>{attributionFor(song)}</p>
        {layers.length > 0 && (
          <p style={{ marginTop: 6 }}>
            {layers.map(l => `${t(LAYER_LABEL[l.layer])}: ${l.license}${l.basis ? ` (${l.basis})` : ""}`).join(" · ")}
          </p>
        )}
      </div>
    </main>
  );
}
