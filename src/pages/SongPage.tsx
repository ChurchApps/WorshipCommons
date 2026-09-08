import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { loadSongPage, SongPageData } from "../songs";
import { parseChordPro, transposeChord, toNashville, splitKey, noteIndex, KEY_CHOICES, FLAT_KEYS, SHARP, FLAT } from "../chordpro";
import { loadTune, parseMidi, TunePlayer } from "../midiPlayer";
import { playPitch, setMetronomeBpm, startMetronome, stopMetronome } from "../practice";
import { abcKeyRoot, abcTitle, abcVoices, melodyOnly, soloVoice, stripLyrics, titlesMatch } from "../abc";
import ChordDiagram from "../components/ChordDiagram";
import { wcPost, wcPut, COMMONS_API } from "../api";
import { makeZip } from "../zip";
import { licenseNotice } from "../licenses";
import { libraryIds, setInLibrary } from "../library";
import { useAuth } from "../auth";
import { usePageMeta } from "../seo";
import { useI18n } from "../i18n";
import { needsCcliReport, noDerivatives, rightsMatrixFor, USES } from "../rights";
import { USE_LABEL } from "../licenses";
import SongHero from "../components/SongHero";
import AboutPanel from "../components/AboutPanel";
import { CONFIDENCE_HELP, CONFIDENCE_LABEL, isDerivedScore } from "../components/ConfidenceBadge";
import AddToSetlist from "../components/AddToSetlist";
import ProjectPanel from "../components/ProjectPanel";
import "../styles/song.css";

const ArrowLeft = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
);

const FileIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>
);

const ExternalIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
);

export default function SongPage() {
  const { t } = useI18n();
  const { id } = useParams();
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
  const [rate, setRate] = useState(100);
  const [capo, setCapo] = useState(0);
  const [copied, setCopied] = useState(false);
  const [packing, setPacking] = useState(false);
  const [textSize, setTextSize] = useState(1);
  const [columns, setColumns] = useState(1);
  const [parts, setParts] = useState<string[]>([]);
  const [solo, setSolo] = useState<number | null>(null);
  const [metro, setMetro] = useState(false);
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
    setCapo(0);
    setParts([]);
    setSolo(null);
    stopMetronome();
    setMetro(false);
  }, [id]);

  // one fetch: detail + rating (mine needs the JWT) + history + family + similar
  const [data, setData] = useState<SongPageData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [rateError, setRateError] = useState("");
  useEffect(() => {
    setData(null);
    setNotFound(false);
    setRateError("");
    if (!id) return;
    let stale = false;
    loadSongPage(id).then(d => { if (stale) return; d ? setData(d) : setNotFound(true); });
    return () => { stale = true; };
  }, [id, user]);
  const song = data?.song ?? null;
  const rating = data?.rating;

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

  const audioShift = useMemo(() => {
    if (!song) return 0;
    const base = tuneRoot || splitKey(song.songKey).root;
    const shift = (noteIndex(splitKey(selectedKey || song.songKey).root) - noteIndex(base) + 12) % 12;
    return shift > 6 ? shift - 12 : shift;
  }, [song, selectedKey, tuneRoot]);

  useEffect(() => { playerRef.current?.setSemitones(audioShift); }, [audioShift]);

  // melody line on the page: top voice, first verse only; lyrics dropped when the tune is borrowed from another hymn
  const melodyRef = useRef<HTMLDivElement>(null);
  const melody = useMemo(() => {
    if (!abc || !song) return "";
    const voices = abcVoices(abc);
    const text = melodyOnly(voices.length > 1 ? soloVoice(abc, voices[0]) : abc);
    return titlesMatch(song.title, abcTitle(abc)) ? text : stripLyrics(text);
  }, [abc, song]);
  useEffect(() => {
    if (!melody) return;
    let stale = false;
    // abcjs is heavy — loaded as its own chunk only when a song has a score
    import("abcjs").then(m => { if (!stale && melodyRef.current) m.default.renderAbc(melodyRef.current, melody, { visualTranspose: audioShift, responsive: "resize", paddingtop: 0, paddingbottom: 0 }); });
    return () => { stale = true; };
  }, [melody, audioShift]);
  useEffect(() => { playerRef.current?.setRate(rate / 100); }, [rate]);
  useEffect(() => { if (metro) setMetronomeBpm(Math.round((song?.bpm || 100) * rate / 100)); }, [metro, song?.bpm, rate]);
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

  // ---- the ND switch: no transposed charts, no arrangement downloads, no generated audio ----
  const matrix = rightsMatrixFor(song);
  const nd = noDerivatives(song);
  const ndReason = nd ? (matrix.arrange.conditions.map(c => t(c)).join(" · ") || t("No derivatives: no arrangements, translations, or transposed charts may be distributed")) : "";

  const { root: origRoot, suffix: keySuffix } = splitKey(song.songKey);
  const { root: selRoot } = splitKey(nd ? song.songKey : (selectedKey || song.songKey));
  const shift = (noteIndex(selRoot) - noteIndex(origRoot) + 12) % 12;
  // capo shifts the written shapes down; sounding key (and audio) stays selectedKey
  const shapeRootAt = (n: number) => {
    const idx = (noteIndex(selRoot) - n + 12) % 12;
    return FLAT_KEYS.has(FLAT[idx]) ? FLAT[idx] : SHARP[idx];
  };
  const effCapo = nd ? 0 : capo;
  const useFlats = FLAT_KEYS.has(shapeRootAt(effCapo));
  // ± stepper walks the same 12 roots the key select offers
  const bumpKey = (n: number) => setSelectedKey(shapeRootAt(-n) + keySuffix);
  const signedShift = shift > 6 ? shift - 12 : shift;
  const dispShift = (shift - effCapo + 12) % 12;
  const keyLabel = selRoot + keySuffix;
  const nash = nashville && !nd;
  // metronome follows the tempo slider when the Listen card is there; rate is 100 otherwise
  const practiceBpm = Math.round((song.bpm || 100) * rate / 100);
  const beatsPerBar = Number(song.timeSignature?.split("/")[0]) || 4;
  const toggleMetronome = () => {
    if (metro) stopMetronome();
    else startMetronome(practiceBpm, beatsPerBar);
    setMetro(!metro);
  };
  const showChord = (chord: string) => nash ? toNashville(chord, origRoot) : transposeChord(chord, dispShift, useFlats);

  const writerHref = song.authorId || song.writerId
    ? `/writers/${encodeURIComponent(song.authorId || song.writerId || "")}`
    : `/songs?q=${encodeURIComponent(song.writer)}`;

  // Lead worship is a hero action; everything else lives on the one page — chart, then about, with the sidebar for the rest
  const leadHref = song.lyricsUrl && song.midiUrl ? `/songs/${song.id}/lead?key=${encodeURIComponent(keyLabel)}` : undefined;
  // provenance footnote: confidence, the derived-score caveat, and whether CCLI needs a report
  const ccliFree = !needsCcliReport(song);
  const ccliUses = USES.filter(u => matrix[u].allowed).map(u => t(USE_LABEL[u]).toLowerCase()).join(", ");
  const derived = isDerivedScore(song.confidence);
  const playPiano = async () => {
    if (nd) return;
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

  const setStars = async (stars: number) => {
    if (!user) { navigate(`/login?next=${encodeURIComponent(location.pathname)}`); return; }
    setRateError("");
    try {
      const result = await wcPut(`/assets/${song.id}/rating`, { stars: rating?.mine === stars ? null : stars }, true);
      setData(d => d && ({ ...d, rating: { average: result?.ratingAverage ?? d.rating.average, count: result?.ratingCount ?? d.rating.count, mine: result?.myRating ?? null } }));
    } catch (e) {
      setRateError((e as Error).message);
    }
  };

  const recordDownload = () => {
    wcPost(`/assets/${song.id}/download`, {}).then(resp => { if (resp?.downloadCount != null) setCount(resp.downloadCount); }).catch(() => {});
  };

  // one zip: chart, lyrics, melody, art, and the license line — built in the browser from files already on the page
  const downloadPack = async () => {
    if (packing || nd) return;
    setPacking(true);
    try {
      const slug = song.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "song";
      const fetchBytes = async (url: string) => new Uint8Array(await (await fetch(url)).arrayBuffer());
      const sources: [string, string][] = [[`${slug}.cho`, `${COMMONS_API}/songs/${song.id}/chordpro`], [`${slug}-lyrics.txt`, `${COMMONS_API}/songs/${song.id}/lyrics`]];
      if (song.midiUrl) sources.push([`${slug}.mid`, song.midiUrl]);
      if (song.artUrl) sources.push([`${slug}-art${song.artUrl.match(/\.\w+$/)?.[0] || ".jpg"}`, song.artUrl]);
      const files = await Promise.all(sources.map(async ([name, url]) => ({ name, data: await fetchBytes(url) })));
      // the notice is a condition of CC grants, so the zip carries the registry line verbatim: writer, license + version, URL
      const license = licenseNotice(song);
      files.push({ name: "LICENSE.txt", data: new TextEncoder().encode(`${song.title} — ${song.writer}, ${song.year}\n${license}\nhttps://worshipcommons.org/songs/${song.id}\n`) });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(makeZip(files));
      a.download = `${slug}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      recordDownload();
    } finally {
      setPacking(false);
    }
  };

  const printHref = `/songs/${song.id}/print?key=${encodeURIComponent(keyLabel)}${effCapo ? `&capo=${effCapo}` : ""}${showChords ? "" : "&chords=0"}`;

  return (
    <main className="wrap">
      <p className="crumb">
        <Link to="/songs"><ArrowLeft />{t("All songs")}</Link>
        <span aria-hidden="true">/</span>
        <span className="crumb-here">{song.title}</span>
      </p>

      <div className="song-layout">
        <article className={"card sheet t" + textSize + (showChords ? "" : " hide-chords")}>
          <SongHero
            song={song}
            keyLabel={keyLabel}
            writerHref={writerHref}
            playState={song.midiUrl ? playState : null}
            onPlay={playPiano}
            playDisabledReason={nd ? ndReason : undefined}
            leadHref={leadHref}
          />
          <div className="sheet-body">
            {nd && (
              <p className="nd-notice" data-testid="nd-notice" role="note">
                <b>{t("As written only.")}</b> {ndReason} {t("Transpose, capo, Nashville numbers, the download pack, and the synthesized preview are off for this song.")}
              </p>
            )}

            <section className="chart-section" data-testid="panel-charts">
              <div className="chart-toolbar">
                {hasChords && (
                  <div className="chart-keys">
                    <div className="ctl"><label htmlFor="transpose">{t("Key")}</label>
                      <select id="transpose" value={selRoot} disabled={nd} title={nd ? ndReason : undefined} onChange={e => setSelectedKey(e.target.value + keySuffix)}>
                        {KEY_CHOICES.map(k => <option key={k} value={k}>{k + keySuffix === song.songKey ? t("{key} (original)", { key: k + keySuffix }) : k + keySuffix}</option>)}
                      </select>
                    </div>
                    <div className="ctl"><label htmlFor="capo">{t("Capo")}</label>
                      <select id="capo" value={effCapo} disabled={nd} title={nd ? ndReason : undefined} onChange={e => setCapo(Number(e.target.value))}>
                        <option value={0}>{t("No capo")}</option>
                        {[1, 2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>{t("{n} — {root} shapes", { n, root: shapeRootAt(n) + keySuffix })}</option>)}
                      </select>
                    </div>
                    <div className="ctl"><label id="transpose-label">{t("Transpose")}</label>
                      <div className="stepper" role="group" aria-labelledby="transpose-label" data-testid="transpose-stepper">
                        <button onClick={() => bumpKey(-1)} aria-label="−1" disabled={nd} title={nd ? ndReason : undefined}>−</button>
                        <span>{signedShift > 0 ? `+${signedShift}` : signedShift}</span>
                        <button onClick={() => bumpKey(1)} aria-label="+1" disabled={nd} title={nd ? ndReason : undefined}>+</button>
                      </div>
                    </div>
                  </div>
                )}
                <div className="chart-view">
                  {hasChords && <label className="switch"><input type="checkbox" id="chords-toggle" checked={showChords} onChange={e => setShowChords(e.target.checked)} /> {t("Chords")}</label>}
                  {hasChords && <label className="switch" title={nd ? ndReason : undefined}><input type="checkbox" id="nashville-toggle" checked={nash} disabled={!showChords || nd} onChange={e => setNashville(e.target.checked)} /> {t("Nashville")}</label>}
                  <div className="columns-toggle" role="group" aria-label={t("Columns")} data-testid="chart-columns">
                    {[1, 2].map(n => <button key={n} className={columns === n ? "on" : ""} aria-pressed={columns === n} onClick={() => setColumns(n)}>{n}</button>)}
                  </div>
                  <div className="text-size" role="group" aria-label={t("Text size")}>
                    {[t("Small"), t("Medium"), t("Large")].map((label, i) => (
                      <button key={i} className={textSize === i ? "on" : ""} aria-label={label} aria-pressed={textSize === i} onClick={() => setTextSize(i)}>A</button>
                    ))}
                  </div>
                </div>
              </div>

              {stanzas.length > 2 && (
                <div className="song-map" aria-label={t("Song structure")}>
                  {stanzas.map((st, i) => (
                    <button key={i} onClick={() => document.querySelectorAll(".stanza")[i]?.scrollIntoView({ behavior: "smooth", block: "start" })}>{st.label}</button>
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

              <p className="chart-links rel-hint" data-testid="chart-links">
                <Link to={printHref}>{t("Print / PDF")}</Link>
                {song.chartPdfUrl && <> · <a href={song.chartPdfUrl} download onClick={recordDownload}>{t("Chart PDF")}</a></>}
                {" · "}<a href={`${COMMONS_API}/songs/${song.id}/chordpro`}>ChordPro</a> · <a href={`${COMMONS_API}/songs/${song.id}/lyrics`}>{t("Lyrics (TXT)")}</a>
                {" · "}<button type="button" className="link-btn" data-testid="copy-lyrics" onClick={copyLyrics}>{copied ? t("Copied ✓") : t("Copy lyrics")}</button>
              </p>
            </section>

            {song.sheetPdfUrl && (
              <section className="page-section" data-testid="sheet-pdf-card">
                <h2 className="section-h">{t("Sheet music")}</h2>
                {/* the browser's own PDF viewer; toolbar hidden so it reads as a page, not an app */}
                <iframe className="pdf-embed" src={`${song.sheetPdfUrl}#toolbar=0&view=FitH`} title={t("{title} — sheet music", { title: song.title })} loading="lazy" data-testid="sheet-pdf-embed" />
                <p className="rel-hint"><a href={song.sheetPdfUrl} target="_blank" rel="noopener">{t("Open full size →")}</a> · <a href={song.sheetPdfUrl} download onClick={recordDownload}>{t("Download PDF")}</a></p>
              </section>
            )}

            <section className="page-section" id="about">
              <h2 className="section-h">{t("About this song")}</h2>
              <AboutPanel song={song} family={data.family} similar={data.similar} history={data.history} writerHref={writerHref} />
            </section>

            {/* provenance, as a footnote: what state the score is in and whether CCLI needs to hear about it */}
            <p className="sheet-foot" role="note">
              {song.confidence && CONFIDENCE_LABEL[song.confidence] && (
                <span className={"confidence-badge " + song.confidence} data-testid="confidence-badge" data-confidence={song.confidence} title={t(CONFIDENCE_HELP[song.confidence])}>{t(CONFIDENCE_LABEL[song.confidence])}</span>
              )}
              {derived && <span data-testid="derived-banner" data-confidence={song.confidence}>{t(CONFIDENCE_HELP[song.confidence!])} — {t("check the notes against a hymnal before Sunday.")}</span>}
              {ccliFree && <span className="ccli-badge" data-testid="ccli-badge" title={t("No CCLI report for: {uses}", { uses: ccliUses })}>{t("No CCLI report needed")}</span>}
            </p>
          </div>
        </article>

        <aside>
          <div className="card side-card setlist-card">
            <AddToSetlist song={song} />
            <button className={"btn " + (inLib ? "btn-ghost" : "btn-primary")} data-testid="library-toggle" onClick={toggleLib}>
              {inLib ? t("✓ Saved") : t("+ Save song")}
            </button>
            {!user && <p className="rel-hint" style={{ marginTop: 10 }}>{t("Sign in to save it to your account.")}</p>}
            {inLib && <p className="rel-hint" style={{ marginTop: 10 }}><Link to="/library">{t("View saved songs →")}</Link></p>}
          </div>

          <div className="card side-card" data-testid="practice-card">
            <h2>{t("Practice")}</h2>
            {song.midiUrl && (
              <>
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
              </>
            )}
            <div className="practice-row">
              <button className={"btn" + (metro ? " btn-primary" : "")} data-testid="metronome-toggle" onClick={toggleMetronome}>
                {metro ? t("■ Stop metronome") : t("▶ Metronome")}
              </button>
              <span className="tempo-val" data-testid="metronome-bpm">{practiceBpm} BPM</span>
            </div>
            <button className="btn practice-pitch" data-testid="pitch-pipe" onClick={() => playPitch(60 + noteIndex(selRoot))}>{t("Play {note}", { note: selRoot })}</button>
            <p className="rel-hint">{song.midiUrl ? t("The preview, tempo, and click follow the key on the page — piano from the melody file, not a recording.") : t("A click in {time} at the tempo above, plus the starting note of {key} to pitch the room.", { time: song.timeSignature, key: keyLabel })}</p>
          </div>

          {(song.demoAudioUrl || song.videoUrl) && (
            <div className="card side-card" data-testid="recordings-card">
              <h2>{t("Recordings")}</h2>
              {song.demoAudioUrl && (
                <>
                  <p className="listen-kind">{t("Demo recording")} · {t("As shared by {writer}", { writer: song.writer })}</p>
                  <audio controls src={song.demoAudioUrl} style={{ width: "100%" }} data-testid="demo-audio" />
                </>
              )}
              {song.videoUrl && (
                <p className="rel-hint"><a href={song.videoUrl} target="_blank" rel="noopener noreferrer" data-testid="watch-link"><ExternalIcon /> {t("Watch a performance")}</a> · {t("opens on YouTube")}</p>
              )}
            </div>
          )}

          {melody && (
            <div className="card side-card" data-testid="melody-card">
              <h2>{t("Melody")}</h2>
              <div ref={melodyRef} className="melody-paper" />
              <p className="rel-hint">{t("Engraved in {key}.", { key: keyLabel })} <Link to={`/songs/${song.id}/sheet?key=${encodeURIComponent(keyLabel)}`}>{t("Full score with all parts →")}</Link></p>
            </div>
          )}

          <div className="card side-card">
            <h2>{t("Project")}</h2>
            <ProjectPanel song={song} />
          </div>

          <div className="card side-card">
            <h2>{t("Take it to Sunday")}</h2>
            <ul className="dl-list">
              <li><FileIcon /><Link to={printHref}>{t("Chord chart (print)")}</Link> <span className="size">{t("PDF via print")} · {keyLabel}{effCapo ? ` · ${t("capo {n}", { n: effCapo })}` : ""}</span></li>
              {song.abcUrl && <li><FileIcon /><Link to={`/songs/${song.id}/sheet?key=${encodeURIComponent(keyLabel)}`} data-testid="sheet-music-link">{t("Sheet music (print)")}</Link> <span className="size">{t("melody & parts")} · {keyLabel}</span></li>}
              {!song.abcUrl && song.midiUrl && <li><FileIcon /><Link to={`/songs/${song.id}/transcribe`} data-testid="transcribe-link">{t("No sheet music yet — help transcribe it")}</Link></li>}
              {song.sheetPdfUrl && <li><FileIcon /><a href={song.sheetPdfUrl} download onClick={recordDownload}>{t("Sheet music (PDF)")}</a></li>}
              {song.stemsZipUrl && <li><FileIcon /><a href={song.stemsZipUrl} className="mt-zip" download onClick={recordDownload}>{t("Multitracks (ZIP)")}</a> <span className="size">{t("stems · {key} · {bpm} BPM", { key: song.songKey, bpm: song.bpm })}</span></li>}
              {song.midiUrl && <li><FileIcon /><a href={song.midiUrl} download onClick={recordDownload}>{t("Melody (MIDI)")}</a></li>}
              {song.abcUrl && <li><FileIcon /><a href={song.abcUrl} download onClick={recordDownload}>{t("Notation (ABC)")}</a> <span className="size">{t("text")}</span></li>}
              <li><FileIcon /><button className="link-btn" data-testid="download-pack" disabled={packing || nd} title={nd ? ndReason : undefined} onClick={downloadPack}>{packing ? t("Packing…") : t("Download pack (.zip)")}</button> <span className="size">{nd ? t("off — as written only") : t("chart · lyrics{midi}{art}", { midi: song.midiUrl ? " · MIDI" : "", art: song.artUrl ? " · art" : "" })}</span></li>
              <li><FileIcon /><a href={`${COMMONS_API}/songs/${song.id}/chordpro`}>ChordPro (.cho)</a> <span className="size">{t("text")}</span></li>
              <li><FileIcon /><a href={`${COMMONS_API}/songs/${song.id}/lyrics`}>{t("Lyrics only (TXT)")}</a> <span className="size">{t("text")}</span></li>
            </ul>
            <p className="rel-hint dl-count">{t("Downloads")}: <span data-testid="download-count">{(count ?? song.downloadCount).toLocaleString()}</span></p>
          </div>

          <div className="card side-card">
            <h2>{t("Rate it")}</h2>
            <div className="stepper" role="group" aria-label={t("Rate this song")} data-testid="rating-stars">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} aria-label={t("{n} stars", { n })} aria-pressed={(rating?.mine || 0) >= n} data-testid={`rating-star-${n}`} onClick={() => setStars(n)}>
                  {(rating?.mine || 0) >= n ? "★" : "☆"}
                </button>
              ))}
            </div>
            {rating?.average != null && (rating.count ?? 0) >= 3 && <p className="rel-hint" style={{ marginTop: 10 }} data-testid="rating-average">{rating.average} ★ ({rating.count})</p>}
            {rateError && <p className="rel-hint" style={{ marginTop: 10, color: "var(--secondary)" }} data-testid="rating-error">{rateError}</p>}
          </div>

          <p className="side-links">
            <Link to={`/songs/${song.id}/edit`} data-testid="propose-edit">{t("Propose an edit")}</Link>
            <span aria-hidden="true">·</span>
            <Link to={`/report?song=${encodeURIComponent(`${song.title} — /songs/${song.id}`)}`}>{t("Report this song")}</Link>
          </p>
        </aside>
      </div>
    </main>
  );
}
