import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { idOf, writerPath, coverOf, kitFile, canLead, leadFiles, listedMidi, loadSongPage, recordingUrlOf, resolveLead, Song, SongPageData, songPath } from "../songs";
import { parseChordPro, transposeChord, toNashville, splitKey, noteIndex, KEY_CHOICES, FLAT_KEYS, chartShapes, rootAt, semitonesBetween } from "../chordpro";
import { loadTune, parseMidi, TunePlayer } from "../midiPlayer";
import { playPitch, setMetronomeBpm, startMetronome, stopMetronome } from "../practice";
import { abcKeyRoot, abcTitle, abcVoices, melodyOnly, soloVoice, stripLyrics, titlesMatch } from "../abc";
import ChordDiagram from "../components/ChordDiagram";
import { wcPost, COMMONS_API } from "../api";
import { libraryIds, setInLibrary } from "../library";
import { useAuth } from "../auth";
import { usePageMeta } from "../seo";
import { useI18n } from "../i18n";
import { needsCcliReport } from "../rights";
import { coverSvg } from "../cover.mjs";
import SongHero, { clock } from "../components/SongHero";
import AboutPanel from "../components/AboutPanel";
import ScriptureConnection from "../components/ScriptureConnection";
import ProjectPanel from "../components/ProjectPanel";
import "../styles/song.css";

const FileIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>
);
const NoteIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
);

const ExternalIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
);
const Chevron = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>;
const PlayIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>;
const StopIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>;

// decorative bars for the player strip
const WAVE = "M0 24h4v8H0zm8-6h3v20H8zm7 2h3v16h-3zm7-8h3v32h-3zm7 4h3v24h-3zm7 6h3v12h-3zm7-10h3v28h-3zm7 2h3v24h-3zm7-6h3v36h-3zm7 10h3v16h-3zm7-4h3v24h-3zm7 2h3v20h-3zm7-8h3v32h-3zm7 6h3v20h-3zm7-2h3v24h-3zm7 8h3v12h-3zm7-12h3v32h-3zm7 4h3v24h-3zm7-6h3v32h-3zm7 10h3v16h-3zm7-4h3v24h-3zm7 2h3v20h-3zm7-8h3v32h-3zm7 6h3v20h-3zm7-2h3v24h-3zm7 8h3v12h-3zm7-10h3v28h-3zm7 2h3v24h-3zm7-6h3v36h-3zm7 10h3v16h-3zm7-4h3v24h-3zm7 2h3v20h-3zm7-8h3v32h-3zm7 6h3v20h-3zm7-2h3v24h-3zm7 4h3v16h-3zm7-8h3v32h-3zm7 10h3v12h-3zm7-6h3v24h-3zm7 2h3v20h-3zm7-4h3v28h-3zm7 8h3v12h-3zm7-10h3v28h-3zm7 4h3v20h-3zm7-2h3v24h-3zm7 6h3v16h-3zm7-8h3v32h-3zm7 4h3v24h-3z";

type Tab = "chords" | "sheet" | "about";

const Thumb = ({ s }: { s: Song }) => {
  const cover = coverOf(s, "thumb");
  return (
    <span className="rel-thumb" aria-hidden="true">
      {cover
        ? <img className={cover.portrait ? "portrait" : "art"} src={cover.src} alt="" loading="lazy" />
        : <span dangerouslySetInnerHTML={{ __html: coverSvg(s, 72, 72) }} />}
    </span>
  );
};

export default function SongPage() {
  const { t } = useI18n();
  const { id: rawId = "" } = useParams();
  const id = idOf(rawId);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [showChords, setShowChords] = useState(true);
  const [nashville, setNashville] = useState(false);
  const [pop, setPop] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [inLib, setInLib] = useState(false);
  const [playState, setPlayState] = useState<"idle" | "loading" | "playing">("idle");
  const [pos, setPos] = useState(0);
  const [rate, setRate] = useState(100);
  const [capo, setCapo] = useState(0);
  const [copied, setCopied] = useState(false);
  const [textSize, setTextSize] = useState(1);
  const [columns, setColumns] = useState(1);
  const [parts, setParts] = useState<string[]>([]);
  const [solo, setSolo] = useState<number | null>(null);
  const [metro, setMetro] = useState(false);
  const [tab, setTab] = useState<Tab>("chords");
  const [midiUrl, setMidiUrl] = useState<string>();
  const [audioDur, setAudioDur] = useState<number | null>(null);
  const playerRef = useRef<TunePlayer | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopPlayback = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    playerRef.current?.stop();
    setPlayState("idle");
  };

  useEffect(() => () => {
    audioRef.current?.pause();
    audioRef.current = null;
    playerRef.current?.stop();
    playerRef.current = null;
    setPlayState("idle");
    setAudioDur(null);
    setRate(100);
    setCapo(0);
    setParts([]);
    setSolo(null);
    stopMetronome();
    setMetro(false);
    setTab("chords");
  }, [id]);

  // one fetch: detail + history + family + similar
  const [data, setData] = useState<SongPageData | null>(null);
  const [notFound, setNotFound] = useState(false);
  useEffect(() => {
    setData(null);
    setNotFound(false);
    if (!id) return;
    let stale = false;
    loadSongPage(id).then(d => { if (stale) return; d ? setData(d) : setNotFound(true); });
    return () => { stale = true; };
  }, [id, user]);
  const song = data?.song ?? null;

  // 44 curated charts are keyed for congregational singing while the OH tune file
  // stays in its hymnal key — the ABC's K: is the audio's true base, not songKey
  const [abc, setAbc] = useState("");
  const tuneRoot = useMemo(() => abcKeyRoot(abc), [abc]);
  useEffect(() => {
    setAbc("");
    if (!song?.abcUrl) return;
    let stale = false;
    fetch(song.abcUrl).then(r => r.ok ? r.text() : "").then(t => { if (!stale && t) setAbc(t); }).catch(() => {});
    return () => { stale = true; };
  }, [song?.abcUrl]);

  const audioShift = useMemo(() => song ? semitonesBetween(tuneRoot || splitKey(song.songKey).root, splitKey(selectedKey || song.songKey).root) : 0, [song, selectedKey, tuneRoot]);

  useEffect(() => { playerRef.current?.setSemitones(audioShift); }, [audioShift]);

  // melody line on the Sheet music tab: top voice, first verse only; lyrics dropped when the tune is borrowed from another hymn
  const melodyRef = useRef<HTMLDivElement>(null);
  const melody = useMemo(() => {
    if (!abc || !song) return "";
    const voices = abcVoices(abc);
    const text = melodyOnly(voices.length > 1 ? soloVoice(abc, voices[0]) : abc);
    return titlesMatch(song.title, abcTitle(abc)) ? text : stripLyrics(text);
  }, [abc, song]);
  useEffect(() => {
    if (!melody || tab !== "sheet") return;
    let stale = false;
    // abcjs is heavy — loaded as its own chunk only when a song has a score
    import("abcjs").then(m => { if (!stale && melodyRef.current) m.default.renderAbc(melodyRef.current, melody, { visualTranspose: audioShift, responsive: "resize", paddingtop: 0, paddingbottom: 0 }); });
    return () => { stale = true; };
  }, [melody, audioShift, tab]);
  useEffect(() => { playerRef.current?.setRate(rate / 100); if (audioRef.current) audioRef.current.playbackRate = rate / 100; }, [rate]);
  useEffect(() => { if (metro) setMetronomeBpm(Math.round((song?.bpm || 100) * rate / 100)); }, [metro, song?.bpm, rate]);
  useEffect(() => { playerRef.current?.setSolo(solo); }, [solo]);
  // the player strip clock
  useEffect(() => {
    if (playState !== "playing") { setPos(0); return; }
    const tick = setInterval(() => setPos(audioRef.current?.currentTime ?? playerRef.current?.getTime() ?? 0), 500);
    return () => clearInterval(tick);
  }, [playState]);

  // parts come from the midi itself, so peek at it up front to show the picker before the first play
  useEffect(() => {
    const urls = song ? leadFiles(song).midi : [];
    if (!urls.length) return;
    let stale = false;
    (async () => {
      for (const url of urls) {
        try {
          const r = await fetch(url);
          if (!r.ok) continue;
          const b = await r.arrayBuffer();
          if (!stale) setParts(parseMidi(b).parts);
          return;
        } catch { /* try the work copy if the package midi 404s */ }
      }
    })();
    return () => { stale = true; };
  }, [song?.id]);

  // canonical URL carries the title slug; bare ids and stale slugs redirect there
  useEffect(() => {
    if (song && song.id === id && `/songs/${rawId}` !== songPath(song)) navigate(songPath(song) + location.search + location.hash, { replace: true });
  }, [song?.id, rawId]);

  useEffect(() => {
    if (!song) { setMidiUrl(undefined); return; }
    let dead = false;
    resolveLead(song).then(r => { if (!dead) setMidiUrl(r.midi || listedMidi(song)); });
    return () => { dead = true; };
  }, [song?.id]);

  useEffect(() => {
    if (song) {
      setSelectedKey(song.songKey);
      setCount(song.downloadCount);
      if (user) libraryIds().then(ids => setInLib(ids.includes(song.id)));
      else setInLib(false);
    }
  }, [song, user]);

  const stanzas = useMemo(() => song?.chordPro ? parseChordPro(song.chordPro) : [], [song]);
  // lyrics-only sheets have nothing to transpose — the key, capo, and chord switches only add noise
  const hasChords = useMemo(() => stanzas.some(st => st.lines.some(line => line.some(seg => seg.chord))), [stanzas]);

  usePageMeta(
    song ? t("{title} — free chords and lyrics | WorshipCommons", { title: song.title }) : "WorshipCommons",
    song ? t("Free chord chart, lyrics, and melody for {title} ({writer}, {year}). Transpose to any key, print it, project it, sing it — no license needed.", { title: song.title, writer: song.writer, year: song.year }) : undefined
  );

  if (notFound) {
    return <main className="wrap"><p className="crumb" style={{ padding: "60px 0" }}>{t("Song not found.")} <Link to="/songs">{t("← All songs")}</Link></p></main>;
  }
  if (!song || !data) return <main className="wrap"><p style={{ padding: "60px 0" }}>{t("Loading…")}</p></main>;

  const { root: origRoot, suffix: keySuffix } = splitKey(song.songKey);
  // capo shifts the written shapes down; sounding key (and audio) stays selectedKey
  const { keyLabel, shift, dispShift, useFlats } = chartShapes(song, selectedKey, capo);
  const selRoot = splitKey(keyLabel).root;
  // ± stepper walks the same 12 roots the key select offers
  const bumpKey = (n: number) => setSelectedKey(rootAt(selRoot, n) + keySuffix);
  const signedShift = shift > 6 ? shift - 12 : shift;
  // metronome follows the tempo slider; rate is 100 when there is no tune to slow down
  const practiceBpm = Math.round((song.bpm || 100) * rate / 100);
  const beatsPerBar = Number(song.timeSignature?.split("/")[0]) || 4;
  const toggleMetronome = () => {
    if (metro) stopMetronome();
    else startMetronome(practiceBpm, beatsPerBar);
    setMetro(!metro);
  };
  const showChord = (chord: string) => nashville ? toNashville(chord, origRoot) : transposeChord(chord, dispShift, useFlats);

  const writerHref = song.authorId || song.writerId
    ? writerPath(song.authorId || song.writerId || "", song.writer)
    : `/songs?q=${encodeURIComponent(song.writer)}`;

  const leadHref = (canLead(song) || (midiUrl && !!(song.chordPro || song.hasTiming || song.lyricsUrl)))
    ? `${songPath(song)}/lead?key=${encodeURIComponent(keyLabel)}`
    : undefined;
  // provenance footnote: whether CCLI needs a report
  const ccliFree = !needsCcliReport(song);
  const recordingUrl = recordingUrlOf(song);
  const playLabel = playState === "loading" ? t("Loading…") : playState === "playing" ? t("Stop") : (recordingUrl || song.hasAccompaniment) ? t("Play") : t("Preview (synthesized)");
  const playPreview = async () => {
    if (playState === "playing") { stopPlayback(); return; }
    setPlayState("loading");
    try {
      if (recordingUrl) {
        const a = new Audio(recordingUrl);
        audioRef.current = a;
        a.preservesPitch = true; // ponytail: native time-stretch; key control still MIDI-only
        a.playbackRate = rate / 100;
        a.onended = () => setPlayState("idle");
        a.onloadedmetadata = () => setAudioDur(a.duration);
        await a.play();
        setPlayState("playing");
        return;
      }
      let p = playerRef.current;
      if (!p && midiUrl) {
        try { p = await loadTune(midiUrl); } catch { p = undefined; }
      }
      if (!p) throw new Error("no midi");
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

  const recordDownload = () => {
    wcPost(`/assets/${song.id}/download`, {}).then(resp => { if (resp?.downloadCount != null) setCount(resp.downloadCount); }).catch(() => {});
  };

  const printHref = `${songPath(song)}/print?key=${encodeURIComponent(keyLabel)}${capo ? `&capo=${capo}` : ""}${showChords ? "" : "&chords=0"}`;
  const sheetHref = `${songPath(song)}/sheet?key=${encodeURIComponent(keyLabel)}`;
  const hasSheet = !!(song.sheetPdfUrl || song.abcUrl || song.midiUrl);

  // the bottom strip: same-language relatives + similar titles, the scripture line, and the translations
  const parent = data.family.find(f => f.id === song.parentSongId) || null;
  const relatives = data.family.filter(f => f.id !== song.id && f.language === song.language);
  const translations = data.family.filter(f => f.id !== song.id && f.language !== song.language);
  const rowSub = (r: Song) => (r.id === parent?.id ? `${t("Original")} · ${r.writer}, ${r.year}` : r.relationLabel || `${r.writer}, ${r.year}`);
  // a translation plays its parent's recording (the file lives in the parent's package): say what language the vocal is in
  const sharedRecording = parent && recordingUrl && !recordingUrl.includes(song.id) ? parent : null;

  const tabs: [Tab, string][] = [["chords", t("Chords & lyrics")], ...(hasSheet ? [["sheet", t("Sheet music")] as [Tab, string]] : []), ["about", t("About & rights")]];

  return (
    <main className={"wrap song-page sheet t" + textSize + (showChords ? "" : " hide-chords")}>
      <p className="crumb">
        <Link to="/songs">{t("Songs")}</Link>
        <span aria-hidden="true">/</span>
        <span className="crumb-here">{song.title}</span>
      </p>

      <SongHero song={song} keyLabel={keyLabel} writerHref={writerHref} leadHref={leadHref} inLibrary={inLib} onToggleLibrary={toggleLib} />

      {(recordingUrl || midiUrl) && (
        <section className={"player" + (playState === "playing" ? " playing" : "")} aria-label={recordingUrl ? t("Demo recording") : t("Piano preview")}>
          <div className="player-meta">
            <b>{recordingUrl ? (song.demoAudioUrl ? t("Demo recording") : t("Master recording")) : song.hasAccompaniment ? t("Piano") : t("Piano preview")}</b>
            <span>{sharedRecording ? t("Sung in {language} · as shared by {writer}", { language: t(sharedRecording.language), writer: sharedRecording.writer }) : recordingUrl ? t("As shared by {writer}", { writer: song.writer }) : song.hasAccompaniment ? t("From the melody file, in the key on the page") : t("Synthesized preview")}</span>
          </div>
          <button
            type="button"
            className={"play-round" + (playState === "playing" ? " on" : "")}
            data-testid="hero-play"
            disabled={playState === "loading"}
            title={playLabel}
            aria-label={playLabel}
            onClick={playPreview}
          >
            {playState === "playing" ? <StopIcon /> : <PlayIcon />}
          </button>
          <svg className="wave" viewBox="0 0 640 48" preserveAspectRatio="none" aria-hidden="true"><path fill="currentColor" d={WAVE} /></svg>
          <span className="time">{clock(pos) || "0:00"}{(audioDur || song.singTimeSeconds) ? ` / ${clock(audioDur || song.singTimeSeconds)}` : ""}</span>
        </section>
      )}

      <div className="song-grid">
        <section className="panel">
          <div className="tabs" role="tablist" data-testid="song-tabs">
            {tabs.map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} data-testid={`tab-${k}`} onClick={() => setTab(k)}>{label}</button>
            ))}
          </div>

          <div hidden={tab !== "chords"} className="sheet-body" data-testid="panel-charts">
            <div className="toolbar">
              {hasChords && (
                <>
                  <label className="ctl" htmlFor="transpose">{t("Key")}
                    <select id="transpose" value={selRoot} onChange={e => setSelectedKey(e.target.value + keySuffix)}>
                      {KEY_CHOICES.map(k => <option key={k} value={k}>{k + keySuffix === song.songKey ? t("{key} (original)", { key: k + keySuffix }) : k + keySuffix}</option>)}
                    </select>
                  </label>
                  <label className="ctl" htmlFor="capo">{t("Capo")}
                    <select id="capo" value={capo} onChange={e => setCapo(Number(e.target.value))}>
                      <option value={0}>0</option>
                      {[1, 2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>{t("{n} — {root} shapes", { n, root: rootAt(selRoot, -n) + keySuffix })}</option>)}
                    </select>
                  </label>
                  <div className="ctl"><span id="transpose-label">{t("Transpose")}</span>
                    <div className="stepper" role="group" aria-labelledby="transpose-label" data-testid="transpose-stepper">
                      <button type="button" onClick={() => bumpKey(-1)} aria-label="−1">−</button>
                      <span>{signedShift > 0 ? `+${signedShift}` : signedShift}</span>
                      <button type="button" onClick={() => bumpKey(1)} aria-label="+1">+</button>
                    </div>
                  </div>
                  <div className="ctl">{t("Display")}
                    <label className="switch"><input type="checkbox" id="chords-toggle" checked={showChords} onChange={e => setShowChords(e.target.checked)} /> {t("Chords")}</label>
                    <label className="switch"><input type="checkbox" id="nashville-toggle" checked={nashville} disabled={!showChords} onChange={e => setNashville(e.target.checked)} /> {t("Nashville")}</label>
                  </div>
                </>
              )}
              <div className="ctl text-size" role="group" aria-label={t("Text size")}>
                {t("Text size")}
                {[t("Small"), t("Medium"), t("Large")].map((label, i) => (
                  <button key={i} type="button" className={textSize === i ? "on" : ""} aria-label={label} aria-pressed={textSize === i} onClick={() => setTextSize(i)}>A</button>
                ))}
              </div>
              <div className="ctl columns-toggle" role="group" aria-label={t("Columns")} data-testid="chart-columns">
                {t("Columns")}
                {[1, 2].map(n => <button key={n} type="button" className={columns === n ? "on" : ""} aria-pressed={columns === n} onClick={() => setColumns(n)}>{n}</button>)}
              </div>
            </div>

            {stanzas.length > 2 && (
              <div className="song-map" aria-label={t("Song structure")}>
                {t("Jump to")}
                {stanzas.map((st, i) => (
                  <button key={i} type="button" title={st.label} onClick={() => document.querySelectorAll(".stanza")[i]?.scrollIntoView({ behavior: "smooth", block: "start" })}>{st.label.replace(/^(Verse|Estrofa|Strophe)\s+(\d+)$/i, "$2")}</button>
                ))}
              </div>
            )}

            <div className={"chart-body" + (columns === 2 ? " two-col" : "")}>
              {stanzas.map((stanza, si) => (
                <section className="stanza" key={si}>
                  <p className="stanza-label">{stanza.label}</p>
                  {stanza.lines.map((segments, li) => (
                    <p className="line" key={li}>
                      {segments.map((seg, gi) => {
                        const k = `${si}-${li}-${gi}`;
                        return (
                          <span className="seg" key={gi}>
                            {seg.chord
                              ? <b className="c" tabIndex={0} onMouseEnter={() => setPop(k)} onMouseLeave={() => setPop("")} onFocus={() => setPop(k)} onBlur={() => setPop("")} onClick={() => setPop(pop === k ? "" : k)}>{showChord(seg.chord)}</b>
                              : <b className="c"> </b>}
                            {/* guitar gets the capo shape on the page; piano gets the sounding chord */}
                            {pop === k && seg.chord && <ChordDiagram guitar={transposeChord(seg.chord, dispShift, useFlats)} piano={transposeChord(seg.chord, shift, FLAT_KEYS.has(selRoot))} />}
                            <span className="t">{seg.text || " "}</span>
                          </span>
                        );
                      })}
                    </p>
                  ))}
                </section>
              ))}
            </div>

            <div className="panel-foot">
              <span className="chart-links" data-testid="chart-links">
                <Link to={printHref}>{t("Print / PDF")}</Link>
                {song.chartPdfUrl && <a href={song.chartPdfUrl} download onClick={recordDownload}>{t("Chart PDF")}</a>}
                <a href={`${COMMONS_API}/songs/${song.id}/chordpro`}>ChordPro</a>
                <a href={`${COMMONS_API}/songs/${song.id}/lyrics`}>{t("Lyrics (TXT)")}</a>
                <button type="button" className="link-btn" data-testid="copy-lyrics" onClick={copyLyrics}>{copied ? t("Copied ✓") : t("Copy lyrics")}</button>
              </span>
              <span data-testid="ccli-footnote">{ccliFree ? <>{song.ccli ? t("CCLI {n} — reporting is optional.", { n: song.ccli }) : t("Free to sing, print, project and stream. No reporting required.")} {t("Keep CCLI for other songs you sing.")}</> : t("Report this song to CCLI when you use it.")}</span>
            </div>
          </div>

          {hasSheet && (
            <div hidden={tab !== "sheet"} className="sheet-tab">
              {melody && (
                <div data-testid="melody-card">
                  <h3>{t("Melody")}</h3>
                  <div ref={melodyRef} className="melody-paper" />
                  <p className="rel-hint">{t("Engraved in {key}.", { key: keyLabel })} <Link to={sheetHref}>{t("Full score with all parts →")}</Link></p>
                </div>
              )}
              {song.sheetPdfUrl && (
                <div data-testid="sheet-pdf-card">
                  <h3>{t("Sheet music")}</h3>
                  {/* the browser's own PDF viewer; toolbar hidden so it reads as a page, not an app */}
                  <iframe className="pdf-embed" src={`${song.sheetPdfUrl}#toolbar=0&view=FitH`} title={t("{title} — sheet music", { title: song.title })} loading="lazy" data-testid="sheet-pdf-embed" />
                  <p className="rel-hint"><a href={song.sheetPdfUrl} target="_blank" rel="noopener">{t("Open full size →")}</a> · <a href={song.sheetPdfUrl} download onClick={recordDownload}>{t("Download PDF")}</a></p>
                </div>
              )}
              {!song.abcUrl && song.midiUrl && (
                <p className="rel-hint"><Link to={`${songPath(song)}/transcribe`} data-testid="transcribe-link">{t("No sheet music yet — help transcribe it")}</Link></p>
              )}
            </div>
          )}

          <div hidden={tab !== "about"}>
            <AboutPanel song={song} similar={data.similar} history={data.history} writerHref={writerHref} />
          </div>
        </section>

        <aside className="side">
          <section className="panel" data-testid="practice-card">
            <h3>{t("Practice")}</h3>
            <p className="hint">{t("Make it work for your gathering.")}</p>
            {song.midiUrl && (
              <>
                <div className="tempo">
                  <label htmlFor="tempo">{t("Tempo")}</label>
                  <span className="tempo-val">{song.bpm ? `${practiceBpm} BPM` : `${rate}%`}</span>
                  <input id="tempo" type="range" min={50} max={150} step={5} value={rate} onChange={e => setRate(Number(e.target.value))} />
                  <div className="step">
                    <button type="button" aria-label={t("Slower")} onClick={() => setRate(r => Math.max(50, r - 5))}>−</button>
                    <button type="button" aria-label={t("Faster")} onClick={() => setRate(r => Math.min(150, r + 5))}>+</button>
                  </div>
                </div>
                {parts.length > 1 && (
                  <div className="parts" data-testid="parts">
                    <span>{t("Practice parts")}</span>
                    <div className="part-row">
                      <button type="button" className={"part-btn" + (solo === null ? " on" : "")} onClick={() => setSolo(null)}>{t("All")}</button>
                      {parts.map((name, i) => (
                        <button type="button" key={name} className={"part-btn" + (solo === i ? " on" : "")} onClick={() => setSolo(solo === i ? null : i)}>{t(name)}</button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            <div className="toggle">
              <button type="button" className="toggle-switch" data-testid="metronome-toggle" aria-pressed={metro} onClick={toggleMetronome}>
                <i aria-hidden="true"></i>{metro ? t("■ Stop metronome") : t("▶ Metronome")}
              </button>
              <span className="tempo-val" data-testid="metronome-bpm">{practiceBpm} BPM</span>
            </div>
            <button type="button" className="btn btn-ghost practice-pitch" data-testid="pitch-pipe" onClick={() => playPitch(60 + noteIndex(selRoot))}>{t("Play {note}", { note: selRoot })}</button>
            <p className="rel-hint">{!recordingUrl && song.midiUrl ? t("The preview, tempo, and click follow the key on the page — piano from the melody file, not a recording.") : t("A click in {time} at the tempo above, plus the starting note of {key} to pitch the room.", { time: song.timeSignature, key: keyLabel })}</p>
            {kitFile(song, "click.mp3") && (
              <div className="kit-audio" data-testid="kit-audio">
                <p className="listen-kind">{t("Click")}<audio controls src={kitFile(song, "click.mp3")} preload="none" /></p>
              </div>
            )}
          </section>

          {(song.masterUrl || song.demoAudioUrl || song.videoUrl) && (
            <section className="panel" data-testid="recordings-card">
              <h3>{t("Recordings")}</h3>
              {song.masterUrl && (
                <>
                  <p className="listen-kind">{t("Master recording")}{song.rights?.recording?.license ? ` · ${song.rights.recording.license}` : ""}</p>
                  <audio controls src={song.masterUrl} style={{ width: "100%" }} data-testid="master-audio" />
                </>
              )}
              {song.demoAudioUrl && (
                <>
                  <p className="listen-kind">{t("Demo recording")} · {t("As shared by {writer}", { writer: song.writer })}</p>
                  <audio controls src={song.demoAudioUrl} style={{ width: "100%" }} data-testid="demo-audio" />
                </>
              )}
              {song.videoUrl && (
                <p className="rel-hint"><a href={song.videoUrl} target="_blank" rel="noopener noreferrer" data-testid="watch-link"><ExternalIcon /> {t("Watch a performance")}</a> · {t("opens on YouTube")}</p>
              )}
            </section>
          )}

          <section className="panel">
            <h3>{t("Downloads")}</h3>
            <p className="hint">{t("Get the resources you need.")}</p>
            <ul className="dl">
              <li><FileIcon /><Link to={printHref}>{t("Chord chart (print)")}</Link> <span className="fmt">PDF · {keyLabel}{capo ? ` · ${t("capo {n}", { n: capo })}` : ""}</span></li>
              {song.compositionZipUrl && (
                <li><FileIcon /><span><a href={song.compositionZipUrl} download onClick={recordDownload}>{t("Composition pack")}</a><small style={{ display: "block", color: "var(--muted)", fontSize: "0.8125rem" }}>{t("Chord chart, lead sheet, sheet music, MIDI, ChordPro, license")}</small></span> <span className="fmt">ZIP</span></li>
              )}
              {song.audioZipUrl && (
                <li><NoteIcon /><span><a href={song.audioZipUrl} download onClick={recordDownload}>{t("Audio pack")}</a><small style={{ display: "block", color: "var(--muted)", fontSize: "0.8125rem" }}>{t("Master recording, full mix, instrumental, extras, license")}</small></span> <span className="fmt">ZIP</span></li>
              )}
              {song.stemsZipUrl && <li><NoteIcon /><a href={song.stemsZipUrl} className="mt-zip" download onClick={recordDownload}>{t("Multitracks (ZIP)")}</a> <span className="fmt">ZIP · {song.songKey}</span></li>}
            </ul>
            <p className="rel-hint dl-count">
              {t("Downloads")}: <span data-testid="download-count">{(count ?? song.downloadCount).toLocaleString()}</span>
              {(song.saveCount || 0) > 0 && <> · {t("Saves")}: <span data-testid="save-count">{(song.saveCount as number).toLocaleString()}</span></>}
            </p>
          </section>

          <section className="panel">
            <h3>{t("Projection")}</h3>
            <p className="hint">{t("Ready for the room.")}</p>
            <ProjectPanel song={song} />
          </section>

          <section className="panel">
            <h3>{t("Improve it")}</h3>
            <p className="side-links">
              <Link to={`${songPath(song)}/edit`} data-testid="propose-edit">{t("Propose an edit")}</Link>
              {!song.masterUrl && <><span aria-hidden="true">·</span><Link to={`${songPath(song)}/edit?type=recording`} data-testid="add-master">{t("Add a master recording")}</Link></>}
              <span aria-hidden="true">·</span>
              <Link to={`/report?song=${encodeURIComponent(`${song.title} — ${songPath(song)}`)}`}>{t("Report this song")}</Link>
            </p>
          </section>
        </aside>
      </div>

      <section className="bottom">
        <div className="col rel">
          <h4>♪ {t("Related songs")} <button type="button" className="more" onClick={() => { setTab("about"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>{t("View all →")}</button></h4>
          {relatives.length > 0 && (
            <ul className="rel-list" data-testid="family-list">
              {relatives.map(r => <li key={r.id}><Thumb s={r} /><div><Link to={`${songPath(r)}`}>{r.title}</Link><span>{rowSub(r)}</span></div><Chevron /></li>)}
            </ul>
          )}
          {data.similar.length > 0 && (
            <ul className="rel-list" data-testid="similar-songs">
              {data.similar.map(s => <li key={s.id}><Thumb s={s} /><div><Link to={`${songPath(s)}`}>{s.title}</Link><span>{s.writer}{s.reason ? ` · ${s.reason}` : ""}</span></div><Chevron /></li>)}
            </ul>
          )}
          {relatives.length === 0 && data.similar.length === 0 && <p className="empty">{t("Nothing related yet.")}</p>}
        </div>
        <ScriptureConnection reference={song.scripture} songId={song.id} />
        <div className="col tr">
          <h4>🌐 {t("Translations")} <Link className="more" to="/upload">{t("Add one →")}</Link></h4>
          {translations.length > 0
            ? (
              <ul className="rel-list" data-testid="translations">
                {translations.map(r => <li key={r.id}><div><Link to={`${songPath(r)}`}>{r.title} · {t(r.language)}</Link></div><Chevron /></li>)}
              </ul>
            )
            : <p className="empty">{t("No translations in the commons yet.")}</p>}
        </div>
      </section>
    </main>
  );
}
