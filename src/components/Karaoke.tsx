import { useEffect, useMemo, useRef, useState } from "react";
import { Song } from "../songs";
import { KEY_CHOICES } from "../chordpro";
import { loadTune, TunePlayer } from "../midiPlayer";
import { useI18n } from "../i18n";

interface TimedWord { t: number; d: number; text: string }
interface TimedStanza { label: string; lines: TimedWord[][] }

interface Props {
  song: Song;
  audioShift: number;
  rate: number;
  onRateChange: (rate: number) => void;
  selRoot: string;
  keySuffix: string;
  onKeyChange: (root: string) => void;
  onClose: () => void;
}

export default function Karaoke({ song, audioShift, rate, onRateChange, selRoot, keySuffix, onKeyChange, onClose }: Props) {
  const { t } = useI18n();
  const [stanzas, setStanzas] = useState<TimedStanza[] | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(-1);
  const playerRef = useRef<TunePlayer | null>(null);

  useEffect(() => {
    let dead = false;
    fetch(song.lyricsUrl!).then(r => r.json()).then(j => { if (!dead) setStanzas(j.stanzas); });
    loadTune(song.midiUrl!).then(p => {
      if (dead) { p.stop(); return; }
      playerRef.current = p;
      p.onEnd = () => setPlaying(false);
      setReady(true);
    });
    return () => { dead = true; playerRef.current?.stop(); playerRef.current = null; };
  }, [song.id, song.lyricsUrl, song.midiUrl]);

  useEffect(() => { playerRef.current?.setSemitones(audioShift); }, [ready, audioShift]);
  useEffect(() => { playerRef.current?.setRate(rate / 100); }, [ready, rate]);
  useEffect(() => {
    if (ready) { playerRef.current!.play(); setPlaying(true); }
  }, [ready]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { flat, lineOf } = useMemo(() => {
    const flat: TimedWord[] = [];
    const lineOf: number[] = [];
    let li = 0;
    stanzas?.forEach(st => st.lines.forEach(line => { line.forEach(w => { flat.push(w); lineOf.push(li); }); li++; }));
    return { flat, lineOf };
  }, [stanzas]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const loop = () => {
      const now = playerRef.current?.getTime() ?? 0;
      // ponytail: O(words) scan per frame — fine at hymn scale (<2k words)
      let i = flat.length - 1;
      while (i >= 0 && flat[i].t > now) i--;
      setCur(i);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, flat]);

  const curLine = cur >= 0 ? lineOf[cur] : -1;
  useEffect(() => {
    document.querySelector(".karaoke-line.cur")?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [curLine]);

  const toggle = () => {
    const p = playerRef.current;
    if (!p) return;
    if (playing) {
      p.pause();
      setPlaying(false);
    } else {
      p.play();
      setPlaying(true);
    }
  };

  let wordIdx = -1, lineIdx = -1;
  return (
    <div className="karaoke" data-testid="karaoke">
      {song.artUrl && (
        <div
          className="karaoke-art"
          style={{ backgroundImage: `linear-gradient(rgba(20,16,30,0.62), rgba(20,16,30,0.62)), url(${song.artUrl})` }}
        />
      )}
      <div className="karaoke-bar">
        <button className="btn btn-primary" data-testid="karaoke-play" disabled={!ready} onClick={toggle}>
          {!ready ? t("Loading…") : playing ? t("❚❚ Pause") : t("▶ Play")}
        </button>
        <span className="karaoke-ctl">
          <label htmlFor="karaoke-key">{t("Key")}</label>
          <select id="karaoke-key" value={selRoot} onChange={e => onKeyChange(e.target.value)}>
            {KEY_CHOICES.map(k => <option key={k} value={k}>{k + keySuffix}</option>)}
          </select>
        </span>
        <span className="karaoke-ctl">
          <label htmlFor="karaoke-tempo">{t("Tempo")}</label>
          <input id="karaoke-tempo" type="range" min={50} max={150} step={5} value={rate} onChange={e => onRateChange(Number(e.target.value))} />
          <span className="tempo-val">{song.bpm ? `${Math.round(song.bpm * rate / 100)} BPM` : `${rate}%`}</span>
        </span>
        <button className="karaoke-close" data-testid="karaoke-close" onClick={onClose} aria-label={t("Close")}>✕</button>
      </div>
      <div className="karaoke-scroll">
        <h1 className="karaoke-title">{song.title}</h1>
        {!stanzas && <p className="karaoke-loading">{t("Loading lyrics…")}</p>}
        {stanzas?.map((st, si) => (
          <section className="karaoke-stanza" key={si}>
            <p className="karaoke-label">{st.label}</p>
            {st.lines.map((line, li) => {
              lineIdx++;
              const mine = lineIdx;
              return (
                <p className={"karaoke-line" + (mine === curLine ? " cur" : "")} key={li}>
                  {line.map((w, wi) => {
                    wordIdx++;
                    const mw = wordIdx;
                    return <span key={wi} className={mw === cur ? "on" : mw < cur ? "sung" : ""}>{w.text}{" "}</span>;
                  })}
                </p>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
