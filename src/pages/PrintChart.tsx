import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { loadSongs, Song } from "../songs";
import { parseChordPro } from "../chordpro";

export default function PrintChart() {
  const { id } = useParams();
  const [songs, setSongs] = useState<Song[]>([]);
  useEffect(() => { loadSongs().then(setSongs); }, []);
  const song = songs.find(s => s.id === id);
  const stanzas = useMemo(() => song ? parseChordPro(song.chordPro) : [], [song]);

  if (!song) return <main style={{ padding: 40 }}>Loading…</main>;

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
      <p style={{ marginBottom: 24 }}>{song.writer} · Key of {song.songKey} · {song.bpm} BPM · {song.timeSignature}</p>
      {stanzas.map((stanza, si) => (
        <section key={si} style={{ marginBottom: 24 }}>
          <p style={{ fontWeight: 700, textTransform: "uppercase", fontSize: 13, letterSpacing: 1 }}>{stanza.label}</p>
          {stanza.lines.map((segments, li) => (
            <p key={li} style={{ margin: "0 0 6px" }}>
              {segments.map((seg, gi) => (
                <span className="print-seg" key={gi}>
                  <span className="print-chord">{seg.chord || " "}</span>
                  <span>{seg.text || " "}</span>
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
