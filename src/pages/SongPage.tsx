import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { loadSong, loadSongs, Song, themeList, formatBytes } from "../songs";
import { parseChordPro, transposeChord, splitKey, noteIndex, KEY_CHOICES, FLAT_KEYS } from "../chordpro";
import { loadTune, TunePlayer } from "../midiPlayer";
import Karaoke from "../components/Karaoke";
import { wcPost, WC_API } from "../api";
import { usePageMeta } from "../seo";
import "../styles/song.css";

export default function SongPage() {
  const { id } = useParams();
  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [showChords, setShowChords] = useState(true);
  const [count, setCount] = useState<number | null>(null);
  const [sung, setSung] = useState(false);
  const [playState, setPlayState] = useState<"idle" | "loading" | "playing">("idle");
  const [rate, setRate] = useState(100);
  const [karaoke, setKaraoke] = useState(false);
  const playerRef = useRef<TunePlayer | null>(null);

  const stopPlayback = () => {
    playerRef.current?.stop();
    setPlayState("idle");
  };

  useEffect(() => () => {
    playerRef.current?.stop();
    playerRef.current = null;
    setPlayState("idle");
    setRate(100);
    setKaraoke(false);
  }, [id]);

  const [song, setSong] = useState<Song | null>(null);
  const [notFound, setNotFound] = useState(false);
  useEffect(() => { loadSongs().then(setSongs); }, []);
  useEffect(() => {
    setSong(null);
    setNotFound(false);
    if (id) loadSong(id).then(s => { s ? setSong(s) : setNotFound(true); });
  }, [id]);

  const audioShift = useMemo(() => {
    if (!song) return 0;
    const shift = (noteIndex(splitKey(selectedKey || song.songKey).root) - noteIndex(splitKey(song.songKey).root) + 12) % 12;
    return shift > 6 ? shift - 12 : shift;
  }, [song, selectedKey]);

  useEffect(() => { playerRef.current?.setSemitones(audioShift); }, [audioShift]);
  useEffect(() => { playerRef.current?.setRate(rate / 100); }, [rate]);

  useEffect(() => {
    if (song) {
      setSelectedKey(song.songKey);
      setCount(song.churchCount);
      setSung(!!localStorage.getItem("wcSung_" + song.id));
    }
  }, [song]);

  const stanzas = useMemo(() => song?.chordPro ? parseChordPro(song.chordPro) : [], [song]);

  usePageMeta(
    song ? `${song.title} — free chords and lyrics | WorshipCommons` : "WorshipCommons",
    song ? `Free chord chart, lyrics, and melody for ${song.title} (${song.writer}, ${song.year}). Transpose to any key, print it, project it, sing it — no license needed.` : undefined
  );

  if (notFound) {
    return <main className="wrap"><p className="crumb" style={{ padding: "60px 0" }}>Song not found. <Link to="/songs">← All songs</Link></p></main>;
  }
  if (!song) return <main className="wrap"><p style={{ padding: "60px 0" }}>Loading…</p></main>;

  const { root: origRoot, suffix: keySuffix } = splitKey(song.songKey);
  const { root: selRoot } = splitKey(selectedKey || song.songKey);
  const shift = (noteIndex(selRoot) - noteIndex(origRoot) + 12) % 12;
  const useFlats = FLAT_KEYS.has(selRoot);
  const keyLabel = selectedKey || song.songKey;

  const related = songs.filter(s => s.parentSongId === song.id);
  const parent = song.parentSongId ? songs.find(s => s.id === song.parentSongId) : null;

  const playPiano = async () => {
    if (playState === "playing") { stopPlayback(); return; }
    setPlayState("loading");
    try {
      const p = playerRef.current || await loadTune(song.midiUrl!);
      playerRef.current = p;
      p.setSemitones(audioShift);
      p.setRate(rate / 100);
      p.onEnd = () => setPlayState("idle");
      p.play();
      setPlayState("playing");
    } catch {
      setPlayState("idle");
    }
  };

  const openKaraoke = () => {
    stopPlayback();
    setKaraoke(true);
  };

  const weSing = async () => {
    const resp = await wcPost(`/songs/${song.id}/sing`, {});
    setCount(resp.churchCount);
    setSung(true);
    localStorage.setItem("wcSung_" + song.id, "1");
  };

  return (
    <main className="wrap">
      <p className="crumb"><Link to="/songs">← All songs</Link></p>

      <div className="song-layout">
        <article className={"card sheet" + (showChords ? "" : " hide-chords")}>
          {song.license === "WC" ? <span className="free-badge">Free for worship</span> : <span className="pd-badge">Public domain</span>}
          <h1 className="song-title">{song.title}</h1>
          <p className="byline">Words and music by {song.writer} · {song.year}</p>
          {song.scriptureText && <p className="epigraph"><b>{song.scriptureText.replace(/ — .*$/, "")}</b> — {song.scripture}</p>}
          <div className="meta-chips">
            <span className="s-tag">Key <b id="key-label">{keyLabel}</b></span>
            <span className="s-tag"><b>{song.bpm}</b> BPM</span>
            <span className="s-tag"><b>{song.timeSignature}</b></span>
            {themeList(song).map(t => <span className="s-tag" key={t}>{t}</span>)}
          </div>

          <div className="toolbar">
            <span><label htmlFor="transpose">Key</label>
              <select id="transpose" value={selRoot} onChange={e => setSelectedKey(e.target.value + keySuffix)}>
                {KEY_CHOICES.map(k => <option key={k} value={k}>{k + keySuffix === song.songKey ? `${k}${keySuffix} (original)` : k + keySuffix}</option>)}
              </select>
            </span>
            <label className="chk"><input type="checkbox" id="chords-toggle" checked={showChords} onChange={e => setShowChords(e.target.checked)} /> Show chords</label>
            <span className="free-note">Any key, no permission needed</span>
          </div>

          {stanzas.map((stanza, si) => (
            <section className="stanza" key={si}>
              <p className="stanza-label">{stanza.label}</p>
              {stanza.lines.map((segments, li) => (
                <p className="line" key={li}>
                  {segments.map((seg, gi) => (
                    <span className="seg" key={gi}>
                      <b className="c">{seg.chord ? transposeChord(seg.chord, shift, useFlats) : " "}</b>
                      <span className="t">{seg.text || " "}</span>
                    </span>
                  ))}
                </p>
              ))}
            </section>
          ))}

          <p className="colophon">
            {song.license === "WC"
              ? <>© {song.year} {song.writer} · Shared through WorshipCommons — free for worship everywhere, always. Commercial use stays with the writer. <Link to="/license">How that works</Link></>
              : <>Public domain — free for any use, anywhere, forever.</>}
          </p>
        </article>

        <aside>
          {song.midiUrl && (
            <div className="card side-card">
              <h2>Listen</h2>
              <button className="btn btn-primary" data-testid="piano-play" disabled={playState === "loading"} onClick={playPiano}>
                {playState === "loading" ? "Loading…" : playState === "playing" ? "■ Stop" : "▶ Play piano"}
              </button>
              <div className="tempo-row">
                <label htmlFor="tempo">Tempo</label>
                <input id="tempo" type="range" min={50} max={150} step={5} value={rate} onChange={e => setRate(Number(e.target.value))} />
                <span className="tempo-val">{song.bpm ? `${Math.round(song.bpm * rate / 100)} BPM` : `${rate}%`}</span>
              </div>
              {song.lyricsUrl && (
                <button className="btn sing-btn" data-testid="sing-along" onClick={openKaraoke}>Sing along</button>
              )}
              <p className="rel-hint">Hymnal piano in {keyLabel}, played right in your browser — pick a different key or tempo and hear it there.</p>
            </div>
          )}

          {song.demoAudioUrl && (
            <div className="card side-card">
              <h2>Demo recording</h2>
              <p style={{ fontSize: "0.875rem", color: "var(--muted)", marginBottom: 10 }}>As shared by {song.writer}</p>
              <audio controls src={song.demoAudioUrl} style={{ width: "100%" }} data-testid="demo-audio" />
            </div>
          )}

          {song.stemsZipUrl && (
            <div className="card side-card">
              <h2>Multitracks</h2>
              <a href={song.stemsZipUrl} className="btn btn-primary mt-zip" download>All stems · ZIP · {formatBytes(song.stemsZipBytes)}</a>
              <p className="rel-hint">One master set, recorded in {song.songKey} at {song.bpm} BPM — every file starts at bar 1. Works in Prime, Playback, Ableton, or any DAW.</p>
            </div>
          )}

          <div className="card side-card">
            <h2>Take it to Sunday</h2>
            <ul className="dl-list">
              <li><Link to={`/songs/${song.id}/print?key=${encodeURIComponent(keyLabel)}`}>Chord chart (print)</Link> <span className="size">PDF via print · {keyLabel}</span></li>
              {song.sheetPdfUrl && <li><a href={song.sheetPdfUrl} download>Sheet music (PDF)</a> <span className="size">{formatBytes(song.sheetPdfBytes)}</span></li>}
              {song.midiUrl && <li><a href={song.midiUrl} download>Melody (MIDI)</a> <span className="size">{formatBytes(song.midiBytes)}</span></li>}
              <li><a href={`${WC_API}/songs/${song.id}/chordpro`}>ChordPro (.cho)</a> <span className="size">text</span></li>
              <li><a href={`${WC_API}/songs/${song.id}/lyrics`}>Lyrics only (TXT)</a> <span className="size">text</span></li>
            </ul>
          </div>

          <div className="card side-card">
            <h2>Who&apos;s singing it</h2>
            <div className="sung-count" data-testid="cong-count">{(count ?? song.churchCount).toLocaleString()}</div>
            <p className="sung-note">churches</p>
            <button className="btn btn-primary we-sing" data-testid="we-sing" disabled={sung} style={sung ? { opacity: 0.65 } : undefined} onClick={weSing}>
              {sung ? "Counted — thank you" : "We sing this"}
            </button>
            <p className="sung-hint">Counts come from churches, not play counts — the real measure of a song is who sings it.</p>
          </div>

          {(related.length > 0 || parent) && (
            <div className="card side-card">
              <h2>In the commons</h2>
              <ul className="rel-list">
                {parent && <li><Link to={`/songs/${parent.id}`}>{parent.title}</Link><span>Original · {parent.writer}, {parent.year}</span></li>}
                {related.map(r => <li key={r.id}><Link to={`/songs/${r.id}`}>{r.title}</Link><span>{r.relationLabel || `${r.writer}, ${r.year}`}</span></li>)}
              </ul>
              <p className="rel-hint">Made an arrangement or translation? <Link to="/upload">Add it back.</Link></p>
            </div>
          )}

          <div className="card side-card">
            <h2>Something wrong?</h2>
            <p style={{ fontSize: "0.875rem", color: "var(--text-2)" }}>Think this song was shared by someone who doesn&apos;t own it?</p>
            <p style={{ marginTop: 10, fontSize: "0.9375rem" }}><Link to="/report" style={{ fontWeight: 600 }}>Report this song →</Link></p>
          </div>
        </aside>
      </div>

      {karaoke && (
        <Karaoke
          song={song}
          audioShift={audioShift}
          rate={rate}
          onRateChange={setRate}
          selRoot={selRoot}
          keySuffix={keySuffix}
          onKeyChange={root => setSelectedKey(root + keySuffix)}
          onClose={() => setKaraoke(false)}
        />
      )}
    </main>
  );
}
