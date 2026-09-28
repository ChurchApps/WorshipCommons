import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { coverOf, isModernWorship, loadSong, loadSongs, recordingUrlOf, Song, songPath, songRecency } from "../songs";
import { published } from "./New";
import { libraryIds, setInLibrary } from "../library";
import { useAuth } from "../auth";
import { usePageMeta } from "../seo";
import { useI18n } from "../i18n";
import { coverSvg } from "../cover.mjs";

// ponytail: newest 50 English writer songs with a recording, shuffled once per visit — add paging/"play more" when the pool outgrows it
const POOL = 50;

function shuffle<T>(a: T[]) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export const Listen: React.FC = () => {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  usePageMeta(t("Listen — WorshipCommons"), t("New songs from writers, shuffled."));
  const [queue, setQueue] = useState<Song[] | null>(null);
  const [i, setI] = useState(0);
  const [saved, setSaved] = useState<string[]>([]);
  const [started, setStarted] = useState(false); // browsers block autoplay until the first press
  const audio = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    // keep the first shuffle — a second load (StrictMode) must not reorder the queue mid-song
    loadSongs().then(all => setQueue(q => q ?? shuffle(all
      .filter(s => s.language === "English" && published(s) && isModernWorship(s) && recordingUrlOf(s))
      .sort((a, b) => songRecency(b) - songRecency(a))
      .slice(0, POOL)))).catch(() => setQueue(q => q ?? []));
  }, []);
  useEffect(() => { if (user) libraryIds().then(setSaved); }, [user]);

  const song = queue?.[i];
  const go = (d: number) => queue?.length && setI((i + d + queue.length) % queue.length);

  // list rows guess sources/master/song.mp3 and sources/cover.webp; the detail row lists the real recording and art
  const [detail, setDetail] = useState<Song>();
  const src = detail && recordingUrlOf(detail);
  useEffect(() => {
    if (!song) return;
    let live = true;
    setDetail(undefined);
    const next = (d?: Song | null) => { if (!live) return; if (d && recordingUrlOf(d)) setDetail(d); else go(1); };
    loadSong(song.id).then(next).catch(() => next());
    return () => { live = false; };
  }, [song?.id]);

  // lock-screen / headphone buttons
  useEffect(() => {
    if (!song || !("mediaSession" in navigator)) return;
    const art = detail && (coverOf(detail) || coverOf(song, "thumb"));
    navigator.mediaSession.metadata = new MediaMetadata({ title: song.title, artist: song.writer, artwork: art ? [{ src: art.src }] : [] });
    navigator.mediaSession.setActionHandler("nexttrack", () => go(1));
    navigator.mediaSession.setActionHandler("previoustrack", () => go(-1));
  });

  const toggleSave = async () => {
    if (!song) return;
    if (!user) { navigate(`/login?next=${encodeURIComponent("/listen")}`); return; }
    const on = saved.includes(song.id);
    await setInLibrary(song.id, !on);
    setSaved(on ? saved.filter(id => id !== song.id) : [...saved, song.id]);
  };

  const art = detail && (coverOf(detail) || coverOf(song, "thumb"));
  return (
    <main className="wrap-narrow" data-testid="listen">
      <div className="page-head">
        <span className="eyebrow">{t("Listen")}</span>
        <h1>{t("New songs from writers, shuffled.")}</h1>
      </div>

      {!queue && <p>{t("Loading…")}</p>}
      {queue?.length === 0 && <p data-testid="listen-empty">{t("No songs found")}</p>}

      {song && (
        <div className="card" style={{ padding: 24, textAlign: "center", marginBottom: 24 }}>
          {art
            ? <img src={art.src} alt="" width={280} height={280} style={{ borderRadius: 12, objectFit: "cover", maxWidth: "100%" }} />
            : <span aria-hidden="true" style={{ width: 280, height: 280, maxWidth: "100%", borderRadius: 12, overflow: "hidden", display: "inline-block" }} dangerouslySetInnerHTML={{ __html: coverSvg(song, 280, 280) }} />}
          <h2 style={{ margin: "16px 0 4px" }} data-testid="listen-title">{song.title}</h2>
          <p className="hint">{song.writer}</p>
          {/* native controls cover play/pause, scrub, and volume */}
          <audio ref={audio} key={src} src={src} controls autoPlay={started} onPlay={() => setStarted(true)} onEnded={() => go(1)} onError={() => go(1)}
            style={{ width: "100%", margin: "16px 0" }} data-testid="listen-audio" />
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button type="button" className="btn" onClick={() => go(-1)} aria-label={t("Previous")}>⏮</button>
            <button type="button" className="btn" onClick={() => { if (audio.current) audio.current.currentTime += 15; }} aria-label={t("Forward 15 seconds")}>+15s</button>
            <button type="button" className="btn" onClick={() => go(1)} aria-label={t("Skip")} data-testid="listen-skip">⏭</button>
            <button type="button" className="btn" onClick={toggleSave} data-testid="listen-save">{saved.includes(song.id) ? t("✓ Saved") : t("+ Save song")}</button>
            <Link className="btn btn-primary" to={songPath(song)} data-testid="listen-details">{t("Song details")}</Link>
          </div>
        </div>
      )}

      {queue && queue.length > 0 && (
        <ol style={{ listStyle: "none", marginBottom: 48 }} data-testid="listen-queue" aria-label={t("Playlist")}>
          {queue.map((s, n) => {
            const thumb = coverOf(s, "thumb");
            return (
              <li key={s.id}>
                {/* a click is a user gesture, so the picked song may autoplay */}
                <button type="button" onClick={() => { setStarted(true); setI(n); }} aria-current={n === i || undefined} data-testid="listen-track"
                  style={{ display: "flex", gap: 12, alignItems: "center", width: "100%", padding: "8px 12px", border: 0, borderRadius: 8, cursor: "pointer", textAlign: "left", color: "inherit", font: "inherit", background: n === i ? "var(--surface-2)" : "transparent" }}>
                  <span className="hint" style={{ width: 24, textAlign: "right", flexShrink: 0 }}>{n === i ? "▶" : n + 1}</span>
                  {thumb
                    ? <img src={thumb.src} alt="" loading="lazy" width={40} height={40} style={{ borderRadius: 4, objectFit: "cover", flexShrink: 0 }} />
                    : <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 4, overflow: "hidden", flexShrink: 0, display: "block" }} dangerouslySetInnerHTML={{ __html: coverSvg(s, 40, 40) }} />}
                  <span style={{ minWidth: 0 }}>
                    <b style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</b>
                    <span className="hint">{s.writer}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
};
