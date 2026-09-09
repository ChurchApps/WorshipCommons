import { Link } from "react-router-dom";
import { coverOf, kindOf, Song, themeList } from "../songs";
import { coverSvg } from "../cover.mjs";
import { licenseOf } from "../licenses";
import { useI18n } from "../i18n";
import LicenseBadge from "./LicenseBadge";
import AddToSetlist from "./AddToSetlist";

const PlayIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" /></svg>;
const HeartIcon = ({ on }: { on: boolean }) => <svg width="18" height="18" viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.4C1.4 7.6 3.7 4 7.2 4c2 0 3.5 1.1 4.8 2.9C13.3 5.1 14.8 4 16.8 4c3.5 0 5.8 3.6 4.5 7.1-1.8 4.8-9.3 9.4-9.3 9.4z" /></svg>;

// "3:31" from seconds; empty when unknown
export const clock = (s?: number | null) => (s && s > 0 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : "");

interface Props {
  song: Song;
  keyLabel: string;
  writerHref: string;
  /** the full-screen Lead worship route, in the key on screen; absent when the song has nothing to lead from */
  leadHref?: string;
  inLibrary: boolean;
  onToggleLibrary: () => void;
}

// Hero: cover, kind, title, writer · year, license + theme tags, key / BPM / meter / duration, and the two live actions.
export default function SongHero({ song, keyLabel, writerHref, leadHref, inLibrary, onToggleLibrary }: Props) {
  const { t } = useI18n();
  const lic = licenseOf(song);
  const time = clock(song.singTimeSeconds);
  const themes = themeList(song);
  const cover = coverOf(song);

  return (
    <section className="song-hero" data-testid="song-hero">
      <div className="song-cover">
        {cover
          ? <img className={cover.portrait ? "portrait" : "art"} src={cover.src} alt="" />
          : <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: coverSvg(song, 336, 336) }} />}
        {cover && !cover.portrait && <div className="overlay" aria-hidden="true">{song.title}</div>}
      </div>
      <div>
        <p className="kicker">{t(kindOf(song))}</p>
        <h1 className="song-title">{song.title}</h1>
        {song.firstLine && <p className="first-line" data-testid="first-line">{song.firstLine}</p>}
        <p className="byline">
          <Link to={writerHref}>{song.writer}</Link> · {song.year}
          {song.tune && <> · {t("Tune")}: <b data-testid="tune-name">{song.tune}</b></>}
        </p>
        <div className="tags">
          <LicenseBadge license={lic} />
          {themes.map(th => <Link className="tag" key={th} to={`/songs?theme=${encodeURIComponent(th)}`}>{th}</Link>)}
          {song.meter && <Link className="tag" data-testid="meter-chip" to={`/songs?meter=${encodeURIComponent(song.meter)}`} title={t("Meter")}>{song.meter}</Link>}
        </div>
        <p className="facts">
          <span className="fact">♪ {t("Key")} <b id="key-label">{keyLabel}</b></span>
          {song.bpm > 0 && <span className="fact">♩ <b>{song.bpm}</b> BPM</span>}
          {song.timeSignature && <span className="fact">𝄞 <b>{song.timeSignature}</b></span>}
          {time && <span className="fact" data-testid="sing-time" title={t("Estimated sing time")}>◷ <b>{time}</b></span>}
        </p>
        {song.recommendedKey && (
          <p className="rec-key" data-testid="recommended-key">
            {t("Recommended key")} <b>{song.recommendedKey}</b>{song.recommendedKeyReason ? ` — ${song.recommendedKeyReason}` : ""}
          </p>
        )}
      </div>
      <div className="hero-actions">
        {leadHref && <Link className="btn btn-primary btn-block" data-testid="lead-worship" to={leadHref}><PlayIcon />{t("Lead worship")}</Link>}
        <div className="row">
          <AddToSetlist song={song} />
          <button type="button" className={"btn btn-ghost btn-icon" + (inLibrary ? " on" : "")} data-testid="library-toggle" aria-pressed={inLibrary} title={inLibrary ? t("Saved") : t("Save song")} onClick={onToggleLibrary}>
            <HeartIcon on={inLibrary} />
            <span className="sr-only">{inLibrary ? t("Saved") : t("Save song")}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
