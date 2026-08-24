import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { loadSong, loadSongs, Song, themeList } from "../songs";
import { parseChordPro, transposeChord, splitKey, noteIndex, KEY_CHOICES, FLAT_KEYS, SHARP, FLAT } from "../chordpro";
import { loadTune, parseMidi, TunePlayer } from "../midiPlayer";
import { abcKeyRoot } from "../abc";
import Karaoke from "../components/Karaoke";
import { wcGet, wcPost, wcPut, COMMONS_API } from "../api";
import { libraryIds, setInLibrary } from "../library";
import { useAuth } from "../auth";
import { usePageMeta } from "../seo";
import { coverSvg } from "../cover.mjs";
import { useI18n } from "../i18n";
import "../styles/song.css";

const youTubeId = (url?: string) => url?.match(/[?&]v=([\w-]{11})/)?.[1];

interface HistoryEntry { submissionId: string; submittedByName?: string; approvedAt?: string; note?: string; filesChanged?: { name: string; action: string }[] }

const ArrowLeft = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
);

const ArrowRight = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);

const FileIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>
);

const InfoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
);

const ChipIcon = ({ d }: { d: string }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const KEY_PATH = "M15.5 4a4.5 4.5 0 1 0-4.24 6L4 17.26V20h3v-2h2v-2h2l1.99-1.99A4.5 4.5 0 0 0 15.5 4z";
const BPM_PATH = "M12 21a8 8 0 1 1 8-8M12 8v4l3 2";
const TIME_PATH = "M4 6h16M4 12h16M4 18h10";
const TAG_PATH = "M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9zM8 8h.01";

export default function SongPage() {
  const { t } = useI18n();
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [showChords, setShowChords] = useState(true);
  const [count, setCount] = useState<number | null>(null);
  const [inLib, setInLib] = useState(false);
  const [playState, setPlayState] = useState<"idle" | "loading" | "playing">("idle");
  const [rate, setRate] = useState(100);
  const [karaoke, setKaraoke] = useState(false);
  const [capo, setCapo] = useState(0);
  const [copied, setCopied] = useState(false);
  const [textSize, setTextSize] = useState(1);
  const [parts, setParts] = useState<string[]>([]);
  const [solo, setSolo] = useState<number | null>(null);
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
    setCapo(0);
    setParts([]);
    setSolo(null);
  }, [id]);

  const [song, setSong] = useState<Song | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [asset, setAsset] = useState<{ ratingAverage?: number | null; ratingCount?: number; myRating?: number | null } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [rateError, setRateError] = useState("");
  useEffect(() => { loadSongs().then(setSongs); }, []);
  useEffect(() => {
    setAsset(null);
    setHistory([]);
    setRateError("");
    if (!id) return;
    wcGet(`/assets/${id}`, true).then(setAsset).catch(() => {});
    wcGet(`/assets/${id}/history`).then(h => setHistory(h || [])).catch(() => {});
  }, [id, user]);
  useEffect(() => {
    setSong(null);
    setNotFound(false);
    if (id) loadSong(id).then(s => { s ? setSong(s) : setNotFound(true); });
  }, [id]);

  // 44 curated charts are keyed for congregational singing while the OH tune file
  // stays in its hymnal key — the ABC's K: is the audio's true base, not songKey
  const [tuneRoot, setTuneRoot] = useState("");
  useEffect(() => {
    setTuneRoot("");
    if (!song?.abcUrl) return;
    let stale = false;
    fetch(song.abcUrl).then(r => r.ok ? r.text() : "").then(t => { if (!stale && t) setTuneRoot(abcKeyRoot(t)); }).catch(() => {});
    return () => { stale = true; };
  }, [song?.abcUrl]);

  const audioShift = useMemo(() => {
    if (!song) return 0;
    const base = tuneRoot || splitKey(song.songKey).root;
    const shift = (noteIndex(splitKey(selectedKey || song.songKey).root) - noteIndex(base) + 12) % 12;
    return shift > 6 ? shift - 12 : shift;
  }, [song, selectedKey, tuneRoot]);

  useEffect(() => { playerRef.current?.setSemitones(audioShift); }, [audioShift]);
  useEffect(() => { playerRef.current?.setRate(rate / 100); }, [rate]);
  useEffect(() => { playerRef.current?.setSolo(solo); }, [solo]);

  // parts come from the midi itself, so peek at it up front to show the picker before the first play
  useEffect(() => {
    if (!song?.midiUrl) return;
    let stale = false;
    fetch(song.midiUrl).then(r => r.arrayBuffer()).then(b => { if (!stale) setParts(parseMidi(b).parts); }).catch(() => {});
    return () => { stale = true; };
  }, [song?.midiUrl]);

  useEffect(() => {
    if (song) {
      setSelectedKey(song.songKey);
      setCount(song.downloadCount);
      if (user) libraryIds().then(ids => setInLib(ids.includes(song.id)));
      else setInLib(false);
    }
  }, [song, user]);

  const stanzas = useMemo(() => song?.chordPro ? parseChordPro(song.chordPro) : [], [song]);

  usePageMeta(
    song ? t("{title} — free chords and lyrics | WorshipCommons", { title: song.title }) : "WorshipCommons",
    song ? t("Free chord chart, lyrics, and melody for {title} ({writer}, {year}). Transpose to any key, print it, project it, sing it — no license needed.", { title: song.title, writer: song.writer, year: song.year }) : undefined
  );

  if (notFound) {
    return <main className="wrap"><p className="crumb" style={{ padding: "60px 0" }}>{t("Song not found.")} <Link to="/songs">{t("← All songs")}</Link></p></main>;
  }
  if (!song) return <main className="wrap"><p style={{ padding: "60px 0" }}>{t("Loading…")}</p></main>;

  const { root: origRoot, suffix: keySuffix } = splitKey(song.songKey);
  const { root: selRoot } = splitKey(selectedKey || song.songKey);
  const shift = (noteIndex(selRoot) - noteIndex(origRoot) + 12) % 12;
  // capo shifts the written shapes down; sounding key (and audio) stays selectedKey
  const shapeRootAt = (n: number) => {
    const idx = (noteIndex(selRoot) - n + 12) % 12;
    return FLAT_KEYS.has(FLAT[idx]) ? FLAT[idx] : SHARP[idx];
  };
  const useFlats = FLAT_KEYS.has(shapeRootAt(capo));
  // ± stepper walks the same 12 roots the key select offers
  const bumpKey = (n: number) => setSelectedKey(shapeRootAt(-n) + keySuffix);
  const signedShift = shift > 6 ? shift - 12 : shift;
  const dispShift = (shift - capo + 12) % 12;
  const keyLabel = selectedKey || song.songKey;

  const parent = song.parentSongId ? songs.find(s => s.id === song.parentSongId) : null;
  // family = own children plus siblings under the same canonical, so translations link both ways
  const related = songs.filter(s => s.id !== song.id && (s.parentSongId === song.id || (parent && s.parentSongId === parent.id)));
  const relIds = new Set([song.id, parent?.id, ...related.map(r => r.id)]);
  const myThemes = new Set(themeList(song));
  const similar = songs
    .filter(s => !relIds.has(s.id) && s.language === song.language && themeList(s).some(th => myThemes.has(th)))
    .sort((a, b) => b.downloadCount - a.downloadCount)
    .slice(0, 4);

  const playPiano = async () => {
    if (playState === "playing") { stopPlayback(); return; }
    setPlayState("loading");
    try {
      const p = playerRef.current || await loadTune(song.midiUrl!);
      playerRef.current = p;
      setParts(p.parts);
      p.setSemitones(audioShift);
      p.setRate(rate / 100);
      p.setSolo(solo);
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

  const copyLyrics = async () => {
    const text = stanzas.map(st => [st.label, ...st.lines.map(l => l.map(seg => seg.text).join("").trimEnd())].join("\n")).join("\n\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const toggleLib = async () => {
    if (!user) { navigate(`/login?next=${encodeURIComponent(location.pathname)}`); return; }
    await setInLibrary(song.id, !inLib);
    setInLib(!inLib);
  };

  const setRating = async (stars: number) => {
    if (!user) { navigate(`/login?next=${encodeURIComponent(location.pathname)}`); return; }
    setRateError("");
    try {
      const result = await wcPut(`/assets/${song.id}/rating`, { stars: asset?.myRating === stars ? null : stars }, true);
      setAsset(a => ({ ...a, ...result }));
    } catch (e) {
      setRateError((e as Error).message);
    }
  };

  const recordDownload = () => {
    wcPost(`/assets/${song.id}/download`, {}).then(resp => { if (resp?.downloadCount != null) setCount(resp.downloadCount); }).catch(() => {});
  };

  return (
    <main className="wrap">
      <p className="crumb">
        <Link to="/songs"><ArrowLeft />{t("All songs")}</Link>
        <span aria-hidden="true">/</span>
        <span className="crumb-here">{song.title}</span>
      </p>

      <div className="song-layout">
        <article className={"card sheet t" + textSize + (showChords ? "" : " hide-chords")}>
          <div className="hero-art">
            {song.artUrl
              ? <div className="hero-cover"><img src={song.artUrl} alt="" /></div>
              : <div className="hero-cover" dangerouslySetInnerHTML={{ __html: coverSvg(song, 900, 300) }} />}
            <div className="hero-scrim">
              <span className="hero-badge">{song.license === "WC" ? <span className="free-badge">{t("Free for worship")}</span> : <span className="pd-badge on-art">{t("Public domain")}</span>}</span>
              <div>
                <h1 className="song-title">{song.title}</h1>
                <p className="byline">{t("Words and music by")} <Link to={`/songs?q=${encodeURIComponent(song.writer)}`}>{song.writer}</Link> · {song.year}</p>
                <div className="meta-chips">
                  <span className="s-tag"><ChipIcon d={KEY_PATH} />{t("Key")} <b id="key-label">{keyLabel}</b></span>
                  <span className="s-tag"><ChipIcon d={BPM_PATH} /><b>{song.bpm}</b> BPM</span>
                  <span className="s-tag"><ChipIcon d={TIME_PATH} /><b>{song.timeSignature}</b></span>
                  {themeList(song).map(th => <Link className="s-tag" key={th} to={`/songs?theme=${encodeURIComponent(th)}`}><ChipIcon d={TAG_PATH} />{th}</Link>)}
                </div>
              </div>
            </div>
          </div>
          <div className="sheet-body">
            {song.scriptureText && <p className="epigraph"><b>{song.scriptureText.replace(/ — .*$/, "")}</b> — {song.scripture}</p>}

            <div className="controls">
              <div className="ctl"><label htmlFor="transpose">{t("Key")}</label>
                <select id="transpose" value={selRoot} onChange={e => setSelectedKey(e.target.value + keySuffix)}>
                  {KEY_CHOICES.map(k => <option key={k} value={k}>{k + keySuffix === song.songKey ? t("{key} (original)", { key: k + keySuffix }) : k + keySuffix}</option>)}
                </select>
              </div>
              <div className="ctl"><label htmlFor="capo">{t("Capo")}</label>
                <select id="capo" value={capo} onChange={e => setCapo(Number(e.target.value))}>
                  <option value={0}>{t("No capo")}</option>
                  {[1, 2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>{t("{n} — {root} shapes", { n, root: shapeRootAt(n) + keySuffix })}</option>)}
                </select>
              </div>
              <div className="ctl"><label id="transpose-label">{t("Transpose")}</label>
                <div className="stepper" role="group" aria-labelledby="transpose-label">
                  <button onClick={() => bumpKey(-1)} aria-label="−1">−</button>
                  <span>{signedShift > 0 ? `+${signedShift}` : signedShift}</span>
                  <button onClick={() => bumpKey(1)} aria-label="+1">+</button>
                </div>
              </div>
            </div>

            <div className="controls-2">
              <label className="switch"><input type="checkbox" id="chords-toggle" checked={showChords} onChange={e => setShowChords(e.target.checked)} /> {t("Show chords")}</label>
              <button className="btn btn-ghost copy-btn" data-testid="copy-lyrics" onClick={copyLyrics}>{copied ? t("Copied ✓") : t("Copy lyrics")}</button>
              <div className="text-size" role="group" aria-label={t("Text size")}>
                {[t("Small"), t("Medium"), t("Large")].map((label, i) => (
                  <button key={i} className={textSize === i ? "on" : ""} aria-label={label} aria-pressed={textSize === i} onClick={() => setTextSize(i)}>A</button>
                ))}
              </div>
            </div>

            {stanzas.length > 2 && (
              <div className="song-map" aria-label={t("Song structure")}>
                {stanzas.map((st, i) => (
                  <button key={i} onClick={() => document.querySelectorAll(".stanza")[i]?.scrollIntoView({ behavior: "smooth", block: "start" })}>{st.label}</button>
                ))}
              </div>
            )}

            {stanzas.map((stanza, si) => (
              <section className="stanza" key={si}>
                <p className="stanza-label">{stanza.label}</p>
                {stanza.lines.map((segments, li) => (
                  <p className="line" key={li}>
                    {segments.map((seg, gi) => (
                      <span className="seg" key={gi}>
                        <b className="c">{seg.chord ? transposeChord(seg.chord, dispShift, useFlats) : " "}</b>
                        <span className="t">{seg.text || " "}</span>
                      </span>
                    ))}
                  </p>
                ))}
              </section>
            ))}

            <div className="license-note">
              <InfoIcon />
              <p>
                {song.license === "WC"
                  ? <>© {song.year} {song.writer} · {t("Shared through WorshipCommons — free for worship everywhere, always. Commercial use stays with the writer.")} <Link to="/license">{t("How that works")}</Link></>
                  : t("Public domain. Free for churches.")}
              </p>
            </div>
          </div>
        </article>

        <aside>
          <div className="card side-card">
            <button className={"btn " + (inLib ? "btn-ghost" : "btn-primary")} data-testid="library-toggle" onClick={toggleLib}>
              {inLib ? t("✓ In your library") : t("+ Add to your library")}
            </button>
            {!user && <p className="rel-hint" style={{ marginTop: 10 }}>{t("Sign in to save it to your account.")}</p>}
            {inLib && <p className="rel-hint" style={{ marginTop: 10 }}><Link to="/library">{t("View your library →")}</Link></p>}
            <p className="rel-hint" style={{ marginTop: 10 }}><Link to={`/songs/${song.id}/edit`} data-testid="propose-edit">{t("Propose an edit")}</Link></p>
          </div>

          <div className="card side-card">
            <h2>{t("How is it?")}</h2>
            <div className="stepper" role="group" aria-label={t("Rate this song")} data-testid="rating-stars">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} aria-label={t("{n} stars", { n })} aria-pressed={(asset?.myRating || 0) >= n} data-testid={`rating-star-${n}`} onClick={() => setRating(n)}>
                  {(asset?.myRating || 0) >= n ? "★" : "☆"}
                </button>
              ))}
            </div>
            {asset?.ratingAverage != null && <p className="rel-hint" style={{ marginTop: 10 }} data-testid="rating-average">{asset.ratingAverage} ★ ({asset.ratingCount})</p>}
            {rateError && <p className="rel-hint" style={{ marginTop: 10, color: "var(--secondary)" }} data-testid="rating-error">{rateError}</p>}
          </div>

          {song.midiUrl && (
            <div className="card side-card">
              <h2>{t("Listen")}</h2>
              <button className="btn btn-primary" data-testid="piano-play" disabled={playState === "loading"} onClick={playPiano}>
                {playState === "loading" ? t("Loading…") : playState === "playing" ? t("■ Stop") : t("▶ Play piano")}
              </button>
              <div className="tempo-row">
                <label htmlFor="tempo">{t("Tempo")}</label>
                <input id="tempo" type="range" min={50} max={150} step={5} value={rate} onChange={e => setRate(Number(e.target.value))} />
                <span className="tempo-val">{song.bpm ? `${Math.round(song.bpm * rate / 100)} BPM` : `${rate}%`}</span>
              </div>
              {parts.length > 1 && (
                <div className="parts-row" data-testid="parts">
                  <span className="parts-label">{t("Hear a part")}</span>
                  <div className="parts-btns">
                    <button className={"part-btn" + (solo === null ? " on" : "")} onClick={() => setSolo(null)}>{t("All")}</button>
                    {parts.map((name, i) => (
                      <button key={name} className={"part-btn" + (solo === i ? " on" : "")} onClick={() => setSolo(solo === i ? null : i)}>{t(name)}</button>
                    ))}
                  </div>
                </div>
              )}
              {song.lyricsUrl && (
                <button className="btn sing-btn" data-testid="sing-along" onClick={openKaraoke}>{t("Sing along")}</button>
              )}
              <p className="rel-hint">{t("Hymnal piano in {key}, played right in your browser — pick a different key or tempo and hear it there. Pick a part to bring that voice out front on choir tone.", { key: keyLabel })}</p>
            </div>
          )}

          {youTubeId(song.videoUrl) && (
            <div className="card side-card">
              <h2>{t("Watch")}</h2>
              <div className="yt-embed">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${youTubeId(song.videoUrl)}`}
                  title={t("{title} — video", { title: song.title })}
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          )}

          {song.writerPortraitUrl && (
            <div className="card side-card">
              <h2>{t("About the writer")}</h2>
              <div className="writer-row">
                <img className="writer-photo" src={song.writerPortraitUrl} alt={t("Portrait of {writer}", { writer: song.writer })} loading="lazy" />
                <div>
                  <b>{song.writer}</b>
                  {song.writerBio && <p className="writer-bio">{song.writerBio}</p>}
                </div>
              </div>
              <p className="writer-src">{t("Portrait & bio via Wikipedia (CC BY-SA).")}</p>
            </div>
          )}

          {song.demoAudioUrl && (
            <div className="card side-card">
              <h2>{t("Demo recording")}</h2>
              <p style={{ fontSize: "0.875rem", color: "var(--muted)", marginBottom: 10 }}>{t("As shared by {writer}", { writer: song.writer })}</p>
              <audio controls src={song.demoAudioUrl} style={{ width: "100%" }} data-testid="demo-audio" />
            </div>
          )}

          {song.stemsZipUrl && (
            <div className="card side-card">
              <h2>{t("Multitracks")}</h2>
              <a href={song.stemsZipUrl} className="btn btn-primary mt-zip" download onClick={recordDownload}>{t("All stems")} · ZIP</a>
              <p className="rel-hint">{t("One master set, recorded in {key} at {bpm} BPM — every file starts at bar 1. Works in Prime, Playback, Ableton, or any DAW.", { key: song.songKey, bpm: song.bpm })}</p>
            </div>
          )}

          <div className="card side-card">
            <h2>{t("Take it to Sunday")}</h2>
            <ul className="dl-list">
              <li><FileIcon /><Link to={`/songs/${song.id}/print?key=${encodeURIComponent(keyLabel)}${capo ? `&capo=${capo}` : ""}`}>{t("Chord chart (print)")}</Link> <span className="size">{t("PDF via print")} · {keyLabel}{capo ? ` · ${t("capo {n}", { n: capo })}` : ""}</span></li>
              {song.abcUrl && <li><FileIcon /><Link to={`/songs/${song.id}/sheet?key=${encodeURIComponent(keyLabel)}`} data-testid="sheet-music-link">{t("Sheet music (print)")}</Link> <span className="size">{t("melody & parts")} · {keyLabel}</span></li>}
              {!song.abcUrl && song.midiUrl && <li><FileIcon /><Link to={`/songs/${song.id}/transcribe`} data-testid="transcribe-link">{t("No sheet music yet — help transcribe it")}</Link></li>}
              {song.sheetPdfUrl && <li><FileIcon /><a href={song.sheetPdfUrl} download onClick={recordDownload}>{t("Sheet music (PDF)")}</a></li>}
              {song.midiUrl && <li><FileIcon /><a href={song.midiUrl} download onClick={recordDownload}>{t("Melody (MIDI)")}</a></li>}
              {song.abcUrl && <li><FileIcon /><a href={song.abcUrl} download onClick={recordDownload}>{t("Notation (ABC)")}</a> <span className="size">{t("text")}</span></li>}
              <li><FileIcon /><a href={`${COMMONS_API}/songs/${song.id}/chordpro`}>ChordPro (.cho)</a> <span className="size">{t("text")}</span></li>
              <li><FileIcon /><a href={`${COMMONS_API}/songs/${song.id}/lyrics`}>{t("Lyrics only (TXT)")}</a> <span className="size">{t("text")}</span></li>
            </ul>
          </div>

          <div className="card side-card">
            <h2>{t("Downloads")}</h2>
            <div className="sung-count" data-testid="download-count">{(count ?? song.downloadCount).toLocaleString()}</div>
            <p className="sung-note">{t("downloads")}</p>
          </div>

          {(related.length > 0 || parent || similar.length > 0) && (
            <div className="card side-card">
              <h2>{t("In the commons")}</h2>
              {(parent || related.length > 0) && (
                <ul className="rel-list">
                  {parent && <li><div><Link to={`/songs/${parent.id}`}>{parent.title}</Link><span>{t("Original")} · {parent.writer}, {parent.year}</span></div><ArrowRight /></li>}
                  {related.map(r => <li key={r.id}><div><Link to={`/songs/${r.id}`}>{r.title}</Link><span>{r.relationLabel || `${r.writer}, ${r.year}`}</span></div><ArrowRight /></li>)}
                </ul>
              )}
              {similar.length > 0 && (
                <>
                  <p className="rel-sub">{t("Similar songs")}</p>
                  <ul className="rel-list" data-testid="similar-songs">
                    {similar.map(s => <li key={s.id}><div><Link to={`/songs/${s.id}`}>{s.title}</Link><span>{s.writer} · {themeList(s).find(th => myThemes.has(th))}</span></div><ArrowRight /></li>)}
                  </ul>
                </>
              )}
              <p className="rel-hint">{t("Made an arrangement or translation?")} <Link to="/upload">{t("Add it back.")}</Link></p>
            </div>
          )}

          {history.length > 0 && (
            <div className="card side-card" data-testid="history">
              <h2>{t("Contributors & changes")}</h2>
              <ul className="rel-list">
                {history.map(h => (
                  <li key={h.submissionId} data-testid="history-entry">
                    <div>
                      <b>{h.submittedByName || t("a community member")}</b>
                      <span>{h.approvedAt ? new Date(h.approvedAt).toLocaleDateString() : ""}{h.note ? ` · ${h.note}` : ""}{h.filesChanged?.length ? ` · ${h.filesChanged.map(f => f.name).join(", ")}` : ""}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="rel-hint">{t("Anyone signed in can propose an edit; a reviewer decides.")}</p>
            </div>
          )}

          <div className="card side-card">
            <h2>{t("Something wrong?")}</h2>
            <p style={{ fontSize: "0.875rem", color: "var(--text-2)" }}>{t("Think this song was shared by someone who doesn’t own it?")}</p>
            <p style={{ marginTop: 10, fontSize: "0.9375rem" }}><Link to={`/report?song=${encodeURIComponent(`${song.title} — /songs/${song.id}`)}`} style={{ fontWeight: 600 }}>{t("Report this song →")}</Link></p>
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
