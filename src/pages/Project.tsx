import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { loadSong, Song } from "../songs";
import { slidesFor } from "../slides";
import { creditLines } from "../exports";
import { usePageMeta } from "../seo";
import { useI18n } from "../i18n";
import "../styles/project.css";

/**
 * Lyrics-only projector for a room with its own musicians: one section per screen, manual advance.
 * Reads the same slide model as every export (slidesFor), so the screen and the FreeShow / OpenLP / PPTX files agree.
 */
export default function Project() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [song, setSong] = useState<Song | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [at, setAt] = useState(0);
  const [blank, setBlank] = useState(false);
  const [light, setLight] = useState(false);

  useEffect(() => {
    if (id) loadSong(id).then(s => { s ? setSong(s) : setNotFound(true); });
  }, [id]);

  const order = useMemo(() => params.get("order")?.split(",").map(s => s.trim()).filter(Boolean), [params]);
  const deck = useMemo(() => (song ? slidesFor(song, order) : null), [song, order]);
  const credit = useMemo(() => (song ? creditLines(song) : []), [song]);
  const count = deck?.slides.length ?? 0;
  const go = (n: number) => { setAt(Math.max(0, Math.min(count - 1, n))); setBlank(false); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      switch (e.key) {
        case " ": case "ArrowRight": case "ArrowDown": case "PageDown": e.preventDefault(); go(at + 1); break;
        case "ArrowLeft": case "ArrowUp": case "PageUp": case "Backspace": e.preventDefault(); go(at - 1); break;
        case "Home": go(0); break;
        case "End": go(count - 1); break;
        case "b": case "B": case ".": setBlank(b => !b); break;
        case "h": case "H": setLight(l => !l); break;
        case "f": case "F": toggleFullscreen(); break;
        case "Escape": if (!document.fullscreenElement) navigate(`/songs/${id}`); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [at, count, id]);

  usePageMeta(song ? t("{title} — project | WorshipCommons", { title: song.title }) : "WorshipCommons");

  if (notFound) return <main className="projector" data-testid="projector"><p className="projector-msg">{t("Song not found.")} <Link to="/songs">{t("Songs")}</Link></p></main>;
  if (!song || !deck) return <main className="projector" data-testid="projector"><p className="projector-msg">{t("Loading…")}</p></main>;

  const slide = deck.slides[at];
  const next = deck.slides[at + 1];
  return (
    <main className={`projector${light ? " projector-light" : ""}${blank ? " projector-blank" : ""}`} data-testid="projector" data-slide={at} data-blank={blank ? "1" : "0"}>
      <div className="projector-stage" data-testid="projector-stage" onClick={() => go(at + 1)}>
        {slide && !blank && (
          <div className="projector-slide" data-testid="projector-slide">
            {slide.lines.map((line, n) => <p key={n}>{line}</p>)}
          </div>
        )}
        {!slide && <p className="projector-msg">{t("No lyrics to project yet.")}</p>}
      </div>
      <footer className="projector-bar" onClick={e => e.stopPropagation()}>
        <div className="projector-meta">
          <span className="projector-label" data-testid="projector-label">{slide?.label}</span>
          <span className="projector-count">{count ? `${at + 1} / ${count}` : ""}</span>
          {next && <span className="projector-next" data-testid="projector-next">{t("Next: {label}", { label: next.label })}</span>}
        </div>
        <div className="projector-picker" data-testid="projector-picker" role="tablist">
          {deck.slides.map((s, n) => (
            <button key={n} type="button" role="tab" aria-selected={n === at} className={n === at ? "on" : ""} data-testid={`pick-${n}`} onClick={() => go(n)}>{s.label}</button>
          ))}
        </div>
        <div className="projector-tools">
          <button type="button" onClick={() => setBlank(b => !b)} data-testid="projector-blank" aria-pressed={blank}>{t("Blank")} <kbd>B</kbd></button>
          <button type="button" onClick={() => setLight(l => !l)} data-testid="projector-contrast">{t("Contrast")} <kbd>H</kbd></button>
          <button type="button" onClick={toggleFullscreen} data-testid="projector-fullscreen">{t("Fullscreen")} <kbd>F</kbd></button>
          <Link to={`/songs/${song.id}`} data-testid="projector-back">{t("← Back to song")} <kbd>Esc</kbd></Link>
        </div>
        <p className="projector-credit" data-testid="projector-credit">{credit.join(" · ")}</p>
      </footer>
    </main>
  );
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => { });
}
