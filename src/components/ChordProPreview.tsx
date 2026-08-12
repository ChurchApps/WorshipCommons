import { useMemo } from "react";
import { parseChordPro } from "../chordpro";
import "../styles/song.css";

export default function ChordProPreview({ chordPro }: { chordPro: string }) {
  const stanzas = useMemo(() => parseChordPro(chordPro), [chordPro]);
  if (stanzas.length === 0) return null;
  return (
    <div className="cp-preview" data-testid="chordpro-preview" aria-live="polite">
      {stanzas.map((stanza, si) => (
        <section className="stanza" key={si}>
          <p className="stanza-label">{stanza.label}</p>
          {stanza.lines.map((segments, li) => (
            <p className="line" key={li}>
              {segments.map((seg, gi) => (
                <span className="seg" key={gi}>
                  <b className="c">{seg.chord || " "}</b>
                  <span className="t">{seg.text || " "}</span>
                </span>
              ))}
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}
