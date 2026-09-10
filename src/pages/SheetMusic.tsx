import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { loadSong, Song } from "../songs";
import { splitKey, KEY_CHOICES, semitonesBetween } from "../chordpro";
import { abcKeyRoot, abcTitle, abcVoices, partName, soloVoice, stripLyrics, titlesMatch } from "../abc";
import { usePageMeta } from "../seo";
import { useI18n } from "../i18n";
import DerivedBanner from "../components/DerivedBanner";
import { attributionFor } from "../licenses";
import { isDerivedScore } from "../components/ConfidenceBadge";

export default function SheetMusic() {
  const { t } = useI18n();
  const { id } = useParams();
  const [params] = useSearchParams();
  const [song, setSong] = useState<Song | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [abc, setAbc] = useState("");
  const [abcFailed, setAbcFailed] = useState(false);
  const [selRoot, setSelRoot] = useState("");
  const [part, setPart] = useState("");
  const paperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) loadSong(id).then(s => { s ? setSong(s) : setNotFound(true); });
  }, [id]);

  useEffect(() => {
    if (!song) return;
    setSelRoot(splitKey(params.get("key") || song.songKey).root);
    if (!song.abcUrl) { setAbcFailed(true); return; }
    let stale = false;
    fetch(song.abcUrl).then(r => r.ok ? r.text() : Promise.reject()).then(text => { if (!stale) setAbc(text); }).catch(() => { if (!stale) setAbcFailed(true); });
    return () => { stale = true; };
  }, [song]);

  const voices = useMemo(() => abcVoices(abc), [abc]);
  const borrowedTune = useMemo(() => !!song && !!abc && !titlesMatch(song.title, abcTitle(abc)), [song, abc]);

  // transpose relative to the score's own K: — what's engraved must match what's selected
  const shift = useMemo(() => song && selRoot ? semitonesBetween(abcKeyRoot(abc) || splitKey(song.songKey).root, selRoot) : 0, [song, selRoot, abc]);

  const rendered = useMemo(() => {
    if (!abc) return "";
    const text = part ? soloVoice(abc, part) : abc;
    return borrowedTune ? stripLyrics(text) : text;
  }, [abc, part, borrowedTune]);

  useEffect(() => {
    if (!rendered) return;
    let stale = false;
    // abcjs is heavy — loaded as its own chunk only on this page
    import("abcjs").then(m => { if (!stale && paperRef.current) m.default.renderAbc(paperRef.current, rendered, { visualTranspose: shift, responsive: "resize" }); });
    return () => { stale = true; };
  }, [rendered, shift]);

  usePageMeta(song ? t("{title} — sheet music | WorshipCommons", { title: song.title }) : "WorshipCommons");

  if (notFound) return <main style={{ padding: 40 }}>{t("Song not found.")} <Link to="/songs">{t("← All songs")}</Link></main>;
  if (!song) return <main style={{ padding: 40 }}>{t("Loading…")}</main>;

  const { suffix: keySuffix } = splitKey(song.songKey);
  // ponytail: MusicXML is not rendered here (no renderer dependency); the ABC stays the engraving source and the
  // footer only reports where that ABC came from
  const source = song.scoreSource || (song.abcUrl ? "abc" : null);

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px" }}>
      <style>{`
        .no-print { margin-bottom: 28px; display: flex; align-items: center; gap: 14px; flex-wrap: wrap; font-size: 0.875rem; }
        .no-print label { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; }
        .no-print select { padding: 8px 12px; border-radius: 10px; font-weight: 500; }
        .no-print .back { margin-left: auto; }
        .derived-banner { display: flex; align-items: flex-start; gap: 8px; margin: 0 0 18px; font-size: 0.8125rem; color: var(--muted); }
        .derived-banner svg { flex: none; margin-top: 2px; color: #B08A1E; }
        @media print { .no-print, .derived-banner { display: none; } main { padding: 0 !important; } }
      `}</style>
      <div className="no-print">
        <button className="btn btn-primary" style={{ padding: "10px 22px", minHeight: 0, fontSize: "0.9375rem" }} onClick={() => window.print()}>{t("Print")}</button>
        <label>{t("Key")}{" "}
          <select value={selRoot} onChange={e => setSelRoot(e.target.value)} data-testid="sheet-key">
            {KEY_CHOICES.map(k => <option key={k} value={k}>{k + keySuffix === song.songKey ? t("{key} (original)", { key: k + keySuffix }) : k + keySuffix}</option>)}
          </select>
        </label>
        {voices.length > 1 && (
          <label>{t("Part")}{" "}
            <select value={part} onChange={e => setPart(e.target.value)} data-testid="sheet-part">
              <option value="">{t("All parts")}</option>
              {voices.map((v, i) => <option key={v} value={v}>{t(partName(i, voices.length))}</option>)}
            </select>
          </label>
        )}
        <Link className="back" to={`/songs/${song.id}`}>{t("← Back to song")}</Link>
      </div>
      <DerivedBanner song={song} />
      {abcFailed && <p>{t("No engraved score is available for this song yet.")} {song.midiUrl && <Link to={`/songs/${song.id}/transcribe`}>{t("Help transcribe it →")}</Link>}</p>}
      {borrowedTune && !abcFailed && <p className="no-print" style={{ fontSize: 14, color: "#555" }}>{t("This song is sung to a shared tune — the score shows the music without words.")}</p>}
      <div ref={paperRef} data-testid="sheet-paper" />
      {abc && (
        <p style={{ marginTop: 32, fontSize: 13, color: "#555" }} data-testid="sheet-footer" data-score-source={source}>
          {/* data-driven: the package says where the score came from and whether a person has proofread it */}
          {source === "master"
            ? t("Engraved in your browser from the proofread score.")
            : source === "midi"
              ? t("Engraved in your browser from a score generated from the MIDI file — not yet proofread.")
              : isDerivedScore(song.confidence) || source === "abc"
                ? t("Engraved in your browser from the Open Hymnal Project ABC — converted, not yet proofread here.")
                : t("Engraved in your browser from the package score.")}
          {" "}{attributionFor(song)}
        </p>
      )}
    </main>
  );
}
