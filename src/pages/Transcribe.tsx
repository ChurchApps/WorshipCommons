import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { loadSong, Song } from "../songs";
import { parseChordPro } from "../chordpro";
import { loadTune, parseMidi, TunePlayer } from "../midiPlayer";
import { draftAbc } from "../abcDraft";
import AbcEditor from "../components/AbcEditor";
import { wcPost } from "../api";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";
import { usePageMeta } from "../seo";

// community transcription: draft ABC from the song's MIDI, clean it up by hand,
// submit for review. Approved scores are promoted to the git master by an admin.
export default function Transcribe() {
  const { t } = useI18n();
  const { id } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const [song, setSong] = useState<Song | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [abc, setAbc] = useState("");
  const [busy, setBusy] = useState(false);
  const [midiState, setMidiState] = useState<"idle" | "loading" | "playing">("idle");
  const [abcPlaying, setAbcPlaying] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const playerRef = useRef<TunePlayer | null>(null);
  const synthRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    if (id) loadSong(id).then(s => { s ? setSong(s) : setNotFound(true); });
  }, [id]);

  const stopAll = () => {
    playerRef.current?.stop();
    synthRef.current?.stop();
    setMidiState("idle");
    setAbcPlaying(false);
  };

  useEffect(() => () => { playerRef.current?.stop(); synthRef.current?.stop(); }, []);

  const stanzas = useMemo(() => song?.chordPro ? parseChordPro(song.chordPro) : [], [song]);

  usePageMeta(song ? t("Transcribe {title} | WorshipCommons", { title: song.title }) : "WorshipCommons");

  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (notFound) return <main className="wrap"><p className="crumb" style={{ padding: "60px 0" }}>{t("Song not found.")} <Link to="/songs">{t("← All songs")}</Link></p></main>;
  if (!song) return <main className="wrap"><p style={{ padding: "60px 0" }}>{t("Loading…")}</p></main>;

  if (song.abcUrl) {
    return (
      <main className="wrap-narrow">
        <div className="page-head">
          <h1>{song.title}</h1>
          <p className="lede">{t("This song already has an engraved score.")} <Link to={`/songs/${song.id}/sheet`}>{t("View the sheet music →")}</Link></p>
        </div>
      </main>
    );
  }

  const draft = async () => {
    if (!song.midiUrl) return;
    if (abc.trim() && !window.confirm(t("Replace your current text with a fresh draft from the MIDI?"))) return;
    setBusy(true);
    try {
      const midi = parseMidi(await (await fetch(song.midiUrl)).arrayBuffer());
      setAbc(draftAbc(midi, song));
    } catch {
      setError(t("Couldn’t read the MIDI file."));
    }
    setBusy(false);
  };

  const playMidi = async () => {
    if (midiState === "playing") { stopAll(); return; }
    stopAll();
    setMidiState("loading");
    try {
      const p = playerRef.current || await loadTune(song.midiUrl!);
      playerRef.current = p;
      p.onEnd = () => setMidiState("idle");
      p.play();
      setMidiState("playing");
    } catch {
      setMidiState("idle");
    }
  };

  const playAbc = async () => {
    if (abcPlaying) { stopAll(); return; }
    stopAll();
    try {
      const m = (await import("abcjs")).default;
      const [visualObj] = m.renderAbc(document.createElement("div"), abc);
      const synth = new m.synth.CreateSynth();
      await synth.init({ visualObj });
      await synth.prime();
      synthRef.current = { stop: () => synth.stop() };
      synth.start();
      setAbcPlaying(true);
    } catch {
      setError(t("Couldn’t play this ABC — check the notation for errors."));
    }
  };

  const submit = async () => {
    setError("");
    try {
      await wcPost(`/songs/${song.id}/abc`, { abc }, true);
      setSubmitted(true);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (submitted) {
    return (
      <main className="wrap-narrow">
        <div className="page-head">
          <h1>{t("Thank you!")}</h1>
          <p className="lede">{t("Your transcription was submitted for review. Once approved, it becomes the engraved score for this song.")}</p>
          <p><Link to={`/songs/${song.id}`}>{t("← Back to song")}</Link></p>
        </div>
      </main>
    );
  }

  return (
    <main className="wrap-narrow">
      <div className="page-head">
        <span className="eyebrow">{t("Help transcribe")}</span>
        <h1>{song.title}</h1>
        <p className="lede">{t("This song has a recording but no engraved score yet. Draft one from the MIDI, tidy it up in ABC notation, and submit it for review.")}</p>
      </div>

      <section className="section">
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            {song.midiUrl && (
              <>
                <button className="btn btn-primary" data-testid="abc-draft" disabled={busy} onClick={draft}>
                  {busy ? t("Loading…") : t("Draft from MIDI")}
                </button>
                <button className="btn btn-ghost" data-testid="play-midi" disabled={midiState === "loading"} onClick={playMidi}>
                  {midiState === "loading" ? t("Loading…") : midiState === "playing" ? t("■ Stop") : t("▶ Play original MIDI")}
                </button>
              </>
            )}
            <button className="btn btn-ghost" data-testid="play-abc" disabled={!abc.trim()} onClick={playAbc}>
              {abcPlaying ? t("■ Stop") : t("▶ Play my ABC")}
            </button>
          </div>
          <AbcEditor value={abc} onChange={setAbc} rows={16} />
          {stanzas.length > 0 && (
            <details style={{ marginTop: 16 }}>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>{t("Lyrics as w: lines (copy under each music line)")}</summary>
              <pre style={{ fontSize: "0.8125rem", overflowX: "auto", marginTop: 10 }}>
                {stanzas.map(st => `% ${st.label}\n` + st.lines.map(l => "w: " + l.map(seg => seg.text).join("").trim()).join("\n")).join("\n\n")}
              </pre>
            </details>
          )}
          {error && <p style={{ color: "var(--secondary)", marginTop: 12 }} data-testid="abc-error">{error}</p>}
          <div style={{ marginTop: 16 }}>
            <button className="btn btn-primary" data-testid="abc-submit" disabled={!abc.trim()} onClick={submit}>{t("Submit for review")}</button>
            <p className="hint" style={{ marginTop: 10 }}>{t("A reviewer checks every submission before it joins the library. The MIDI draft is rough — fix rhythms and add lyrics before submitting.")}</p>
          </div>
        </div>
      </section>
    </main>
  );
}
