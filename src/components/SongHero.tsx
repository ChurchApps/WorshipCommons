import { Link } from "react-router-dom";
import { Song, themeList } from "../songs";
import { coverSvg } from "../cover.mjs";
import { licenseOf } from "../licenses";
import { useI18n } from "../i18n";
import LicenseBadge from "./LicenseBadge";

const PlayIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" /></svg>;
const StopIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>;
const ScreenIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg>;

// "≈ 2:45" from seconds; empty when unknown
const singTime = (s?: number | null) => (s && s > 0 ? `≈ ${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : "");

interface Props {
  song: Song;
  keyLabel: string;
  writerHref: string;
  /** null = no playable audio for this song; the button is not rendered */
  playState: "idle" | "loading" | "playing" | null;
  onPlay?: () => void;
  /** set when the ND switch (or anything else) forbids generated audio */
  playDisabledReason?: string;
  /** the full-screen Lead worship route, in the key on screen; absent when the song has nothing to lead from */
  leadHref?: string;
}

// Hero: the art carries only the name, the first line, and the two live actions (preview, lead). The facts a
// musician scans for — key, tempo, meter, themes, license — sit on a plain strip underneath where they are legible.
export default function SongHero({ song, keyLabel, writerHref, playState, onPlay, playDisabledReason, leadHref }: Props) {
  const { t } = useI18n();
  const lic = licenseOf(song);
  const time = singTime(song.singTimeSeconds);
  const playLabel = playState === "loading" ? t("Loading…") : playState === "playing" ? t("Stop") : song.hasAccompaniment ? t("Play") : t("Preview (synthesized)");
  const themes = themeList(song);

  return (
    <div className="song-head" data-testid="song-hero">
      <div className="hero-art">
        {song.artUrl
          ? <div className="hero-cover"><img src={song.artUrl} alt="" /></div>
          : <div className="hero-cover" dangerouslySetInnerHTML={{ __html: coverSvg(song, 900, 300) }} />}
        <div className="hero-scrim">
          <div className="hero-text">
            <h1 className="song-title">{song.title}</h1>
            {song.firstLine && <p className="first-line" data-testid="first-line">{song.firstLine}</p>}
            <p className="byline">
              {t("Words and music by")} <Link to={writerHref}>{song.writer}</Link>&nbsp;·&nbsp;{song.year}
              {song.tune && <> · {t("Tune")}: <b data-testid="tune-name">{song.tune}</b></>}
            </p>
          </div>
          {(playState !== null || leadHref) && (
            <div className="hero-actions">
              {playState !== null && onPlay && (
                <button
                  type="button"
                  className={"hero-play" + (playState === "playing" ? " on" : "")}
                  data-testid="hero-play"
                  disabled={playState === "loading" || !!playDisabledReason}
                  title={playDisabledReason || playLabel}
                  aria-label={playLabel}
                  onClick={onPlay}
                >
                  {playState === "playing" ? <StopIcon /> : <PlayIcon />}
                  <span>{playState === "loading" ? t("Loading…") : playState === "playing" ? t("Stop") : t("Preview")}</span>
                </button>
              )}
              {leadHref && <Link className="hero-btn" data-testid="lead-worship" to={leadHref}><ScreenIcon />{t("Lead worship")}</Link>}
            </div>
          )}
        </div>
      </div>

      <div className="song-facts">
        <span className="fact"><LicenseBadge license={lic} /></span>
        <span className="fact"><span className="fact-k">{t("Key")}</span> <b id="key-label">{keyLabel}</b></span>
        {song.bpm > 0 && <span className="fact"><b>{song.bpm}</b> BPM</span>}
        {song.timeSignature && <span className="fact"><b>{song.timeSignature}</b></span>}
        {time && <span className="fact" data-testid="sing-time" title={t("Estimated sing time")}>{time}</span>}
        {song.meter && <Link className="fact" data-testid="meter-chip" to={`/songs?meter=${encodeURIComponent(song.meter)}`}><span className="fact-k">{t("Meter")}</span> <b>{song.meter}</b></Link>}
        {themes.map(th => <Link className="fact fact-theme" key={th} to={`/songs?theme=${encodeURIComponent(th)}`}>{th}</Link>)}
      </div>
      {song.recommendedKey && (
        <p className="rec-key" data-testid="recommended-key">
          {t("Recommended key")} <b>{song.recommendedKey}</b>{song.recommendedKeyReason ? ` — ${song.recommendedKeyReason}` : ""}
        </p>
      )}
    </div>
  );
}
