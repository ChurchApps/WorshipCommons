import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { loadSong, Song } from "../songs";
import { parseChordPro, transposeChord, splitKey, noteIndex, FLAT_KEYS } from "../chordpro";
import { usePageMeta } from "../seo";

export default function PrintChart() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const [song, setSong] = useState<Song | null>(null);
  const [notFound, setNotFound] = useState(false);
  useEffect(() => {
    if (id) loadSong(id).then(s => { s ? setSong(s) : setNotFound(true); });
  }, [id]);
  const stanzas = useMemo(() => song?.chordPro ? parseChordPro(song.chordPro) : [], [song]);
  usePageMeta(song ? `${song.title} — chord chart | WorshipCommons` : "WorshipCommons");

  if (notFound) return <main style={{ padding: 40 }}>Song not found. <Link to="/songs">← All songs</Link></main>;
  if (!song) return <main style={{ padding: 40 }}>Loading…</main>;

  const { root: origRoot, suffix: keySuffix } = splitKey(song.songKey);
  const { root: selRoot } = splitKey(params.get("key") || song.songKey);
  const shift = (noteIndex(selRoot) - noteIndex(origRoot) + 12) % 12;
  const useFlats = FLAT_KEYS.has(selRoot);
  const keyLabel = selRoot + keySuffix;

  return (
    <main style={{ maxWidth: 700, margin: "0 auto", padding: "40px 24px", fontFamily: "Georgia, serif" }}>
      <style>{`
        .print-chord { display: block; font-family: monospace; font-weight: 700; min-height: 1.1em; }
        .print-seg { display: inline-block; vertical-align: bottom; white-space: pre-wrap; }
        .no-print { margin-bottom: 24px; }
        @media print { .no-print { display: none; } }
      `}</style>
      <div className="no-print">
        <button onClick={() => window.print()} style={{ padding: "8px 20px", cursor: "pointer" }}>Print</button>
        {" "}<Link to={`/songs/${song.id}`}>← Back to song</Link>
      </div>
      <h1 style={{ marginBottom: 4 }}>{song.title}</h1>
      <p style={{ marginBottom: 24 }}>{song.writer} · Key of {keyLabel} · {song.bpm} BPM · {song.timeSignature}</p>
      {stanzas.map((stanza, si) => (
        <section key={si} style={{ marginBottom: 24 }}>
          <p style={{ fontWeight: 700, textTransform: "uppercase", fontSize: 13, letterSpacing: 1 }}>{stanza.label}</p>
          {stanza.lines.map((segments, li) => (
            <p key={li} style={{ margin: "0 0 6px" }}>
              {segments.map((seg, gi) => (
                <span className="print-seg" key={gi}>
                  <span className="print-chord">{seg.chord ? transposeChord(seg.chord, shift, useFlats) : " "}</span>
                  <span>{seg.text || " "}</span>
                </span>
              ))}
            </p>
          ))}
        </section>
      ))}
      <p style={{ marginTop: 32, fontSize: 13, color: "#555" }}>
        {song.license === "WC" ? `© ${song.year} ${song.writer} · Shared through WorshipCommons — free for worship everywhere, always.` : "Public domain."}
      </p>
    </main>
  );
}
