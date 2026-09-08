import { useState } from "react";
import { Link } from "react-router-dom";
import { Song, themeList } from "../songs";
import { coverSvg } from "../cover.mjs";
import { attributionFor, licenseOf, USE_LABEL } from "../licenses";
import { needsCcliReport, rightsMatrixFor, USES } from "../rights";
import { useI18n } from "../i18n";
import LicenseBadge from "./LicenseBadge";
import ConfidenceBadge from "./ConfidenceBadge";

const ChipIcon = ({ d }: { d: string }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const KEY_PATH = "M15.5 4a4.5 4.5 0 1 0-4.24 6L4 17.26V20h3v-2h2v-2h2l1.99-1.99A4.5 4.5 0 0 0 15.5 4z";
const BPM_PATH = "M12 21a8 8 0 1 1 8-8M12 8v4l3 2";
const TIME_PATH = "M4 6h16M4 12h16M4 18h10";
const METER_PATH = "M3 8h18v8H3zM8 8v4M13 8v4M18 8v4";
const TAG_PATH = "M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9zM8 8h.01";
const CLOCK_PATH = "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2";

const PlayIcon = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" /></svg>;
const StopIcon = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>;

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
}

// Hero: what it sounds like, can our people sing it, what is ready, may we use this version. Everything a church
// reads before pressing play sits here; the modes below the hero carry the work.
export default function SongHero({ song, keyLabel, writerHref, playState, onPlay, playDisabledReason }: Props) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const lic = licenseOf(song);
  const matrix = rightsMatrixFor(song);
  const ccliFree = !needsCcliReport(song);
  const allowedUses = USES.filter(u => matrix[u].allowed).map(u => t(USE_LABEL[u]).toLowerCase()).join(", ");
  const time = singTime(song.singTimeSeconds);

  const copyAttribution = async () => {
    await navigator.clipboard.writeText(attributionFor(song));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Today hasAccompaniment is false for every song, so the label says what the button really plays; when a rendered
  // accompaniment exists the same button plays it and the label follows.
  const playLabel = playState === "loading" ? t("Loading…") : playState === "playing" ? t("Stop") : song.hasAccompaniment ? t("Play") : t("Preview (synthesized)");

  return (
    <div className="hero-art" data-testid="song-hero">
      {song.artUrl
        ? <div className="hero-cover"><img src={song.artUrl} alt="" /></div>
        : <div className="hero-cover" dangerouslySetInnerHTML={{ __html: coverSvg(song, 900, 300) }} />}
      <div className="hero-scrim">
        <div className="hero-badges">
          <span className="hero-badge"><LicenseBadge license={lic} onArt /></span>
          <ConfidenceBadge confidence={song.confidence} onArt />
          {ccliFree && (
            <span className="ccli-badge" data-testid="ccli-badge" title={t("No CCLI report for: {uses}", { uses: allowedUses })}>{t("No CCLI report needed")}</span>
          )}
        </div>
        <div className="hero-main">
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
              <span>{playLabel}</span>
            </button>
          )}
          <div className="hero-text">
            <h1 className="song-title">{song.title}</h1>
            {song.firstLine && <p className="first-line" data-testid="first-line">{song.firstLine}</p>}
            <p className="byline">
              {t("Words and music by")} <Link to={writerHref}>{song.writer}</Link> · {song.year}
              {song.tune && <> · {t("Tune")}: <b data-testid="tune-name">{song.tune}</b></>}
            </p>
            <div className="meta-chips">
              <span className="s-tag"><ChipIcon d={KEY_PATH} />{t("Key")} <b id="key-label">{keyLabel}</b></span>
              {song.bpm > 0 && <span className="s-tag"><ChipIcon d={BPM_PATH} /><b>{song.bpm}</b> BPM</span>}
              {song.timeSignature && <span className="s-tag"><ChipIcon d={TIME_PATH} /><b>{song.timeSignature}</b></span>}
              {time && <span className="s-tag" data-testid="sing-time" title={t("Estimated sing time")}><ChipIcon d={CLOCK_PATH} /><b>{time}</b></span>}
              {song.meter && <Link className="s-tag" data-testid="meter-chip" to={`/songs?meter=${encodeURIComponent(song.meter)}`}><ChipIcon d={METER_PATH} />{t("Meter")} <b>{song.meter}</b></Link>}
              {themeList(song).map(th => <Link className="s-tag" key={th} to={`/songs?theme=${encodeURIComponent(th)}`}><ChipIcon d={TAG_PATH} />{th}</Link>)}
            </div>
            {song.recommendedKey && (
              <p className="rec-key" data-testid="recommended-key">
                {t("Recommended key")} <b>{song.recommendedKey}</b>{song.recommendedKeyReason ? ` — ${song.recommendedKeyReason}` : ""}
              </p>
            )}
            <div className="hero-actions">
              <button type="button" className="hero-copy" data-testid="copy-attribution" onClick={copyAttribution} title={attributionFor(song)}>
                {copied ? t("Copied") : t("Copy attribution")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
