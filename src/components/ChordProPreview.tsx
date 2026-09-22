import React, { useMemo } from "react";
import { parseChordPro } from "../chordpro";
import "../styles/song.css";

interface Props {
  chordPro: string;
}

export const ChordProPreview: React.FC<Props> = (props) => {
  const stanzas = useMemo(() => parseChordPro(props.chordPro), [props.chordPro]);
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
};
