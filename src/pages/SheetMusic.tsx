import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { loadSong, Song } from "../songs";
import { splitKey, noteIndex, KEY_CHOICES } from "../chordpro";
import { abcKeyRoot, abcTitle, abcVoices, partName, soloVoice, stripLyrics, titlesMatch } from "../abc";
import { usePageMeta } from "../seo";
import { useI18n } from "../i18n";

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
  const shift = useMemo(() => {
    if (!song || !selRoot) return 0;
    const base = abcKeyRoot(abc) || splitKey(song.songKey).root;
    const s = (noteIndex(selRoot) - noteIndex(base) + 12) % 12;
    return s > 6 ? s - 12 : s;
  }, [song, selRoot, abc]);

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

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 24px" }}>
      <style>{`
        .no-print { margin-bottom: 24px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
        @media print { .no-print { display: none; } main { padding: 0 !important; } }
      `}</style>
      <div className="no-print">
        <button onClick={() => window.print()} style={{ padding: "8px 20px", cursor: "pointer" }}>{t("Print")}</button>
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
        <Link to={`/songs/${song.id}`}>{t("← Back to song")}</Link>
      </div>
      {abcFailed && <p>{t("No engraved score is available for this song yet.")} {song.midiUrl && <Link to={`/songs/${song.id}/transcribe`}>{t("Help transcribe it →")}</Link>}</p>}
      {borrowedTune && !abcFailed && <p className="no-print" style={{ fontSize: 14, color: "#555" }}>{t("This song is sung to a shared tune — the score shows the music without words.")}</p>}
      <div ref={paperRef} data-testid="sheet-paper" />
      {abc && (
        <p style={{ marginTop: 32, fontSize: 13, color: "#555" }}>
          {t("Engraved in your browser from the Open Hymnal Project score — public domain, free for any use.")}
        </p>
      )}
    </main>
  );
}
