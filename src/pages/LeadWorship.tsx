import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { leadFiles, loadSong, Song } from "../songs";
import { KEY_CHOICES, noteIndex, parseChordPro, splitKey } from "../chordpro";
import { abcKeyRoot } from "../abc";
import { Instrument, loadTune, TunePlayer } from "../midiPlayer";
import { startMetronome, stopMetronome } from "../practice";
import { useI18n } from "../i18n";
import { usePageMeta } from "../seo";
import "../styles/lead.css";

interface TimedWord { t: number; d: number; text: string }
interface TimedStanza { label: string; lines: TimedWord[][] }
interface Pick { label: string; on: boolean }
/** one entry of the run: a timing stanza plus the slice of the tune it sings over */
interface Segment { label: string; stanza: number; start: number; end: number }

const firstT = (st: TimedStanza | undefined) => st?.lines[0]?.[0]?.t ?? 0;

// The MIDI plays every verse in the timing file's order, so a picked section is a time slice of the tune.
// Labels repeat ("Chorus") and a form may name a section the timing lacks — walk forward for the next match,
// fall back to the first, drop what has no timing.
function timingFromChordPro(chordPro: string, duration: number): TimedStanza[] {
  const parsed = parseChordPro(chordPro);
  const lineCount = Math.max(1, parsed.reduce((n, s) => n + s.lines.length, 0));
  const step = duration / lineCount;
  let t = 0;
  return parsed.map(s => ({
    label: s.label,
    lines: s.lines.map(line => {
      const tokens = line.map(seg => seg.text).join("").split(/(\s+)/).filter(w => w.length);
      const slice = step / Math.max(1, tokens.length);
      const words = tokens.map(w => {
        const word = { t, d: slice, text: w };
        t += slice;
        return word;
      });
      return words.length ? words : [{ t, d: step, text: " " }];
    })
  }));
}

function buildRun(labels: string[], stanzas: TimedStanza[], duration: number): Segment[] {
  const out: Segment[] = [];
  let cursor = 0;
  for (const label of labels) {
    let i = stanzas.findIndex((s, k) => k >= cursor && s.label === label);
    if (i < 0) i = stanzas.findIndex(s => s.label === label);
    if (i < 0) continue;
    cursor = i + 1;
    // stanza 0 owns the intro; every later stanza starts on its first sung word
    const start = i === 0 ? 0 : firstT(stanzas[i]);
    const end = i + 1 < stanzas.length ? firstT(stanzas[i + 1]) : duration;
    out.push({ label, stanza: i, start, end });
  }
  return out;
}

// -1 while the intro plays, else the last line whose first word has started
const lineAt = (st: TimedStanza, t: number) => {
  let i = -1;
  while (i + 1 < st.lines.length && (st.lines[i + 1][0]?.t ?? Infinity) <= t) i++;
  return i;
};
const wordAt = (line: TimedWord[], t: number) => {
  let i = -1;
  while (i + 1 < line.length && line[i + 1].t <= t) i++;
  return i;
};

export default function LeadWorship() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t: tr } = useI18n();

  const [song, setSong] = useState<Song | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [stanzas, setStanzas] = useState<TimedStanza[] | null>(null);
  const [duration, setDuration] = useState(0);
  const [tuneRoot, setTuneRoot] = useState("");
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [counting, setCounting] = useState(false);
  const [time, setTime] = useState(0);
  const [segIdx, setSegIdx] = useState(0);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [keySel, setKeySel] = useState("");
  const [rate, setRate] = useState(100);
  const [countIn, setCountIn] = useState(true);
  const [instrument, setInstrument] = useState<Instrument>("acoustic_grand_piano");
  const [blank, setBlank] = useState(false);
  const [contrast, setContrast] = useState(false);
  const [legend, setLegend] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [tvHelp, setTvHelp] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const playerRef = useRef<TunePlayer | null>(null);
  const countRef = useRef(0);

  usePageMeta(song ? `${tr("Lead worship")} — ${song.title}` : tr("Lead worship"));

  useEffect(() => {
    if (id) loadSong(id).then(s => { s ? setSong(s) : setNotFound(true); });
  }, [id]);

  // song → timing, tune, and the tune's own key (a borrowed tune may not sit in songKey)
  useEffect(() => {
    if (!song) return;
    let dead = false;
    const files = leadFiles(song);
    const abc = song.abcUrl || files.midi[0]?.replace(/tune\.mid$/, "tune.abc");
    if (files.timing) {
      fetch(files.timing).then(r => r.ok ? r.json() : Promise.reject()).then(j => {
        if (!dead) { setStanzas(j.stanzas || []); setDuration(j.duration || 0); }
      }).catch(() => { if (!dead) setStanzas([]); });
    } else setStanzas([]);
    if (abc) fetch(abc).then(r => r.ok ? r.text() : "").then(a => { if (!dead && a) setTuneRoot(abcKeyRoot(a)); }).catch(() => {});
    const tryMidi = (i: number) => {
      if (dead || i >= files.midi.length) return;
      loadTune(files.midi[i]).then(p => {
        if (dead) { p.stop(); return; }
        playerRef.current = p;
        setDuration(d => d || p.duration);
        setReady(true);
      }).catch(() => tryMidi(i + 1));
    };
    tryMidi(0);
    return () => { dead = true; playerRef.current?.stop(); playerRef.current = null; stopMetronome(); window.clearTimeout(countRef.current); };
  }, [song?.id]);

  // no timing.json: spread the ChordPro lines across the tune so Play still works
  useEffect(() => {
    if (!song?.chordPro || !stanzas || stanzas.length || !duration) return;
    setStanzas(timingFromChordPro(song.chordPro, duration));
  }, [song?.id, stanzas, duration]);

  // the run starts as the form's default order; without a form map the timing file's stanzas are the order
  useEffect(() => {
    if (!song || !stanzas?.length) return;
    const labels = song.form?.defaultOrder?.length ? song.form.defaultOrder : stanzas.map(s => s.label);
    setPicks(labels.map(label => ({ label, on: true })));
  }, [song?.id, stanzas]);

  const { root: origRoot, suffix: keySuffix } = splitKey(song?.songKey || "C");
  useEffect(() => {
    if (!song) return;
    const wanted = params.get("key");
    if (!wanted) { setKeySel(song.songKey); return; }
    const { root, suffix } = splitKey(wanted);
    setKeySel(root + (suffix || keySuffix));
  }, [song?.id]);

  // audio shift is relative to the tune's own key (ABC K: when the tune is borrowed), as the song page does
  const shift = useMemo(() => {
    if (!keySel) return 0;
    const s = (noteIndex(splitKey(keySel).root) - noteIndex(tuneRoot || origRoot) + 12) % 12;
    return s > 6 ? s - 12 : s;
  }, [keySel, tuneRoot, origRoot]);

  // picks may have moved the pointer before the tune arrived
  useEffect(() => { if (ready) playerRef.current?.seek(time); }, [ready]);
  useEffect(() => { playerRef.current?.setSemitones(shift); }, [ready, shift]);
  useEffect(() => { playerRef.current?.setRate(rate / 100); }, [ready, rate]);
  useEffect(() => { playerRef.current?.setInstrument(instrument).catch(() => {}); }, [ready, instrument]);

  const run = useMemo(() => stanzas ? buildRun(picks.filter(p => p.on).map(p => p.label), stanzas, duration || Infinity) : [], [picks, stanzas, duration]);

  // any change to the run puts the pointer back at its top
  useEffect(() => {
    const p = playerRef.current;
    if (p && playing) { p.pause(); setPlaying(false); }
    setSegIdx(0);
    const start = run[0]?.start ?? 0;
    setTime(start);
    p?.seek(start);
  }, [run]);

  const seg = run[segIdx];
  const stanza = seg && stanzas ? stanzas[seg.stanza] : undefined;
  const curLine = stanza ? lineAt(stanza, time) : -1;
  const shownLine = Math.max(0, curLine);

  // follow the clock while playing; hop to the next slice when a stanza ends and the next isn't contiguous
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const loop = () => {
      const p = playerRef.current;
      const cur = run[segIdx];
      if (!p || !cur) return;
      const now = p.getTime();
      if (now >= cur.end - 0.02) {
        const next = run[segIdx + 1];
        if (!next) {
          p.pause();
          setPlaying(false);
          setSegIdx(0);
          setTime(run[0].start);
          p.seek(run[0].start);
          return;
        }
        setSegIdx(segIdx + 1);
        if (Math.abs(next.start - cur.end) > 0.05) p.seek(next.start);
        return;
      }
      setTime(now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, segIdx, run]);

  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    p.onEnd = () => { setPlaying(false); setSegIdx(0); setTime(run[0]?.start ?? 0); p.seek(run[0]?.start ?? 0); };
  }, [ready, run]);

  const goTo = (s: number, at: number) => {
    setSegIdx(s);
    setTime(at);
    playerRef.current?.seek(at);
  };

  const cancelCountIn = () => {
    window.clearTimeout(countRef.current);
    stopMetronome();
    setCounting(false);
  };

  const toggle = () => {
    const p = playerRef.current;
    if (!p || !song || !seg) return;
    if (counting) { cancelCountIn(); return; }
    if (playing) { p.pause(); setTime(p.getTime()); setPlaying(false); return; }
    const start = () => { p.play(); setPlaying(true); };
    // ponytail: the count-in also precedes stanza 0's own intro; a pianist would play one or the other — v2 (predictable ending, ritard) decides
    if (countIn && time <= seg.start + 0.01) {
      const bpm = Math.max(20, Math.round((song.bpm || 100) * rate / 100));
      const beats = Number(song.timeSignature?.split("/")[0]) || 4;
      startMetronome(bpm, beats);
      setCounting(true);
      // the metronome's first click lands 100 ms out; the bar ends one beat after its last click
      countRef.current = window.setTimeout(() => { stopMetronome(); setCounting(false); start(); }, 100 + beats * 60000 / bpm);
    } else start();
  };

  const nextLine = () => {
    if (!stanza || !seg) return;
    const target = Math.max(curLine, 0) + 1;
    if (target < stanza.lines.length) goTo(segIdx, stanza.lines[target][0].t);
    else if (run[segIdx + 1]) goTo(segIdx + 1, firstT(stanzas![run[segIdx + 1].stanza]));
  };
  const prevLine = () => {
    if (!stanza || !seg || !stanzas) return;
    if (curLine > 0) goTo(segIdx, stanza.lines[curLine - 1][0].t);
    else if (curLine === 0 && seg.start < firstT(stanza)) goTo(segIdx, seg.start);
    else if (run[segIdx - 1]) {
      const prev = stanzas[run[segIdx - 1].stanza];
      goTo(segIdx - 1, prev.lines[prev.lines.length - 1]?.[0]?.t ?? run[segIdx - 1].start);
    }
  };
  const nextStanza = () => { if (run[segIdx + 1]) goTo(segIdx + 1, run[segIdx + 1].start); };
  const prevStanza = () => {
    if (!seg) return;
    if (time > seg.start + 0.5) goTo(segIdx, seg.start);
    else if (run[segIdx - 1]) goTo(segIdx - 1, run[segIdx - 1].start);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };
  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // one listener, always seeing the latest handlers; form controls keep their own keys
  const keys = useRef<(e: KeyboardEvent) => void>(() => {});
  keys.current = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if (e.key === " " && tag === "BUTTON") return; // a focused button owns its own Space
    if (e.key === "Escape") {
      if (document.fullscreenElement) return; // the browser leaves fullscreen on its own
      if (tvHelp || showPicker) { setTvHelp(false); setShowPicker(false); return; }
      navigate(`/songs/${id}`);
      return;
    }
    const actions: Record<string, () => void> = {
      " ": toggle,
      ArrowRight: nextLine,
      ArrowLeft: prevLine,
      ArrowDown: nextStanza,
      ArrowUp: prevStanza,
      b: () => setBlank(v => !v),
      h: () => setContrast(v => !v),
      f: toggleFullscreen
    };
    const act = actions[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (!act) return;
    e.preventDefault();
    act();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keys.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (notFound) return <main className="wrap"><p style={{ padding: "60px 0" }}>{tr("Song not found.")} <Link to="/songs">{tr("Songs")}</Link></p></main>;
  if (!song) return <main className="wrap"><p style={{ padding: "60px 0" }}>{tr("Loading…")}</p></main>;

  const published = song.publishedKeys?.length ? song.publishedKeys : [song.songKey];
  const preview = KEY_CHOICES.map(k => k + keySuffix).filter(k => !published.includes(k));
  const bpm = Math.round((song.bpm || 100) * rate / 100);
  const nextLineWords = stanza ? stanza.lines[shownLine + 1] : undefined;
  const nextSeg = run[segIdx + 1];
  const nextStanzaFirst = !nextLineWords && nextSeg && stanzas ? stanzas[nextSeg.stanza].lines[0] : undefined;
  const totalLines = run.reduce((n, s) => n + (stanzas?.[s.stanza].lines.length || 0), 0);
  const doneLines = run.slice(0, segIdx).reduce((n, s) => n + (stanzas?.[s.stanza].lines.length || 0), 0) + shownLine;
  const curWord = stanza && curLine >= 0 ? wordAt(stanza.lines[curLine], time) : -1;

  // ponytail: up/down buttons instead of drag — a native drag list is the upgrade when setlists store per-song orders
  const movePick = (i: number, dir: -1 | 1) => setPicks(ps => {
    const j = i + dir;
    if (j < 0 || j >= ps.length) return ps;
    const next = ps.slice();
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  return (
    <div className={"lead" + (contrast ? " hc" : "")} data-testid="lead-worship">
      {blank && (
        <div className="lead-blank" data-testid="lead-blank-screen" onClick={() => setBlank(false)}>
          <span>{tr("Blank — press B to bring the words back")}</span>
        </div>
      )}

      <header className="lead-bar">
        <Link className="lead-close" data-testid="lead-close" to={`/songs/${song.id}`} aria-label={tr("← Back to song")}>✕</Link>
        <button className="btn btn-primary lead-play" data-testid="lead-play" disabled={!ready || !run.length} onClick={toggle}>
          {!ready ? tr("Loading…") : counting ? tr("Counting in…") : playing ? tr("❚❚ Pause") : tr("▶ Play")}
        </button>
        <span className="lead-ctl lead-audio-label" data-testid="lead-audio-label">{song.hasAccompaniment ? tr("Accompaniment") : tr("Preview (synthesized)")}</span>
        <span className="lead-ctl lead-seg" data-testid="lead-instrument" role="group" aria-label={tr("Instrument")}>
          <button className={instrument === "acoustic_grand_piano" ? "on" : ""} onClick={() => setInstrument("acoustic_grand_piano")}>{tr("Piano")}</button>
          <button className={instrument === "church_organ" ? "on" : ""} onClick={() => setInstrument("church_organ")}>{tr("Organ")}</button>
        </span>
        {/* ponytail: guide vocal on/off goes here once an engine passes the Phase 0 trial — no control until then */}
        <span className="lead-ctl">
          <label htmlFor="lead-key">{tr("Key")}</label>
          <select id="lead-key" data-testid="lead-key" value={keySel} onChange={e => setKeySel(e.target.value)}>
            <optgroup label={tr("Published keys")}>
              {published.map(k => <option key={k} value={k}>{k === song.recommendedKey ? tr("{key} (recommended)", { key: k }) : k}</option>)}
            </optgroup>
            {preview.length > 0 && (
              <optgroup label={tr("Preview — not yet reviewed")}>
                {preview.map(k => <option key={k} value={k}>{k}</option>)}
              </optgroup>
            )}
          </select>
        </span>
        <span className="lead-ctl">
          <label htmlFor="lead-tempo">{tr("Tempo")}</label>
          <input id="lead-tempo" data-testid="lead-tempo" type="range" min={50} max={150} step={5} value={rate} onChange={e => setRate(Number(e.target.value))} />
          <span className="lead-bpm" data-testid="lead-bpm">{bpm} {tr("BPM")}</span>
        </span>
        <label className="lead-ctl lead-check">
          <input type="checkbox" data-testid="lead-count-in" checked={countIn} onChange={e => setCountIn(e.target.checked)} /> {tr("Count-in")}
        </label>
        <button className={"lead-tool" + (showPicker ? " on" : "")} data-testid="lead-verses" onClick={() => { setShowPicker(v => !v); setTvHelp(false); }}>{tr("Verses")}</button>
        <button className="lead-tool" data-testid="lead-blank" onClick={() => setBlank(v => !v)}>{tr("Blank")}</button>
        <button className={"lead-tool" + (contrast ? " on" : "")} data-testid="lead-contrast" onClick={() => setContrast(v => !v)}>{tr("Contrast")}</button>
        <button className="lead-tool" data-testid="lead-fullscreen" onClick={toggleFullscreen}>{fullscreen ? tr("Exit fullscreen") : tr("Fullscreen")}</button>
        <button className={"lead-tool" + (tvHelp ? " on" : "")} data-testid="lead-tv-help" onClick={() => { setTvHelp(v => !v); setShowPicker(false); }}>{tr("Put this on the TV")}</button>
      </header>

      {showPicker && stanzas && (
        <aside className="lead-panel lead-picker" data-testid="verse-picker">
          <h2>{tr("Verses")}</h2>
          <ul>
            {picks.map((p, i) => (
              <li key={i}>
                <label><input type="checkbox" checked={p.on} onChange={e => setPicks(ps => ps.map((q, k) => k === i ? { ...q, on: e.target.checked } : q))} /> {p.label}</label>
                <button onClick={() => movePick(i, -1)} disabled={i === 0} aria-label={tr("Move up")}>↑</button>
                <button onClick={() => movePick(i, 1)} disabled={i === picks.length - 1} aria-label={tr("Move down")}>↓</button>
              </li>
            ))}
          </ul>
          <p className="lead-run-label">{tr("Run order")}</p>
          <ol className="lead-run" data-testid="run-order">
            {run.map((s, i) => <li key={i} className={i === segIdx ? "cur" : ""}>{s.label}</li>)}
          </ol>
        </aside>
      )}

      {tvHelp && (
        <aside className="lead-panel lead-tv" data-testid="tv-help">
          <h2>{tr("Put this on the TV")}</h2>
          <ol>
            <li>{tr("Plug the laptop into the TV with an HDMI cable (or cast the whole screen).")}</li>
            <li>{tr("Press F for fullscreen — the browser hides its own bars.")}</li>
            <li>{tr("Mirror the display so the TV shows this screen, or extend it and drag this window onto the TV.")}</li>
          </ol>
          <p>{tr("Nothing to install: this page is the player.")}</p>
        </aside>
      )}

      <main className="lead-stage" onClick={() => { setShowPicker(false); setTvHelp(false); }}>
        {!stanzas && <p className="lead-muted">{tr("Loading lyrics…")}</p>}
        {stanzas && !run.length && <p className="lead-muted" data-testid="lead-empty">{stanzas.length ? tr("Pick at least one verse.") : tr("This song has no timed lyrics yet.")}</p>}
        {seg && stanza && (
          <>
            <p className="lead-stanza-label" data-testid="lead-stanza">{seg.label}</p>
            <p className="lead-line cur" data-testid="lead-line">
              {stanza.lines[shownLine]?.map((w, wi) => (
                <span key={wi} className={curLine === shownLine && wi === curWord ? "on" : curLine === shownLine && wi < curWord ? "sung" : ""}>{w.text}{" "}</span>
              ))}
            </p>
            <p className="lead-line next" data-testid="lead-next">
              {(nextLineWords || nextStanzaFirst)?.map(w => w.text).join(" ")}
              {!nextLineWords && nextStanzaFirst && <small> · {nextSeg!.label}</small>}
            </p>
          </>
        )}
      </main>

      <footer className="lead-foot">
        <div className="lead-progress" aria-hidden="true"><div style={{ width: `${totalLines ? Math.min(100, (doneLines / totalLines) * 100) : 0}%` }} /></div>
        <p className="lead-legend">
          {legend && <span>{tr("Space play/pause · ← → line · ↑ ↓ verse · B blank · H contrast · F fullscreen · Esc back")}</span>}
          <button onClick={() => setLegend(v => !v)}>{legend ? tr("Hide keys") : tr("Show keys")}</button>
        </p>
      </footer>
    </div>
  );
}
