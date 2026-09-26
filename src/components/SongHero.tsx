import React from "react";
import { Link } from "react-router-dom";
import { coverOf, kindOf, Song, themeList } from "../songs";
import { coverSvg } from "../cover.mjs";
import { licenseOf } from "../licenses";
import { useI18n } from "../i18n";
import { LicenseBadge } from "./LicenseBadge";
import { AddToSetlist } from "./AddToSetlist";
import { SupportWriter, type WriterLink } from "./SupportWriter";

const PlayIcon: React.FC = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" /></svg>;

interface HeartIconProps {
  on: boolean;
}

const HeartIcon: React.FC<HeartIconProps> = (props) => <svg width="18" height="18" viewBox="0 0 24 24" fill={props.on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.4C1.4 7.6 3.7 4 7.2 4c2 0 3.5 1.1 4.8 2.9C13.3 5.1 14.8 4 16.8 4c3.5 0 5.8 3.6 4.5 7.1-1.8 4.8-9.3 9.4-9.3 9.4z" /></svg>;

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
  supportLinks?: WriterLink[];
}

// Hero: cover, kind, title, writer · year, license + theme tags, key / BPM / meter / duration, and the two live actions.
export const SongHero: React.FC<Props> = (props) => {
  const supportLinks = props.supportLinks ?? [];
  const { t } = useI18n();
  const lic = licenseOf(props.song);
  const time = clock(props.song.singTimeSeconds);
  const themes = themeList(props.song);
  const cover = coverOf(props.song);

  return (
    <section className="song-hero" data-testid="song-hero">
      <div className="song-cover">
        {cover
          ? <img className={cover.portrait ? "portrait" : "art"} src={cover.src} alt="" />
          : <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: coverSvg(props.song, 336, 336) }} />}
      </div>
      <div>
        <p className="kicker">{t(kindOf(props.song))}</p>
        <h1 className="song-title">{props.song.title}</h1>
        {props.song.firstLine && <p className="first-line" data-testid="first-line">{props.song.firstLine}</p>}
        <p className="byline">
          <Link to={props.writerHref}>{props.song.writer}</Link> · {props.song.year}
          {props.song.tune && <> · {t("Tune")}: <b data-testid="tune-name">{props.song.tune}</b></>}
        </p>
        <div className="tags">
          <LicenseBadge license={lic} />
          {props.song.ccli && <span className="tag" data-testid="ccli-badge" title={t("Reporting to CCLI is optional.")}>{t("CCLI {n}", { n: props.song.ccli })}</span>}
          {themes.map(th => <Link className="tag" key={th} to={`/songs?theme=${encodeURIComponent(th)}`}>{th}</Link>)}
          {props.song.meter && <Link className="tag" data-testid="meter-chip" to={`/songs?meter=${encodeURIComponent(props.song.meter)}`} title={t("Meter")}>{props.song.meter}</Link>}
        </div>
        <p className="facts">
          <span className="fact">♪ {t("Key")} <b id="key-label">{props.keyLabel}</b></span>
          {props.song.bpm > 0 && <span className="fact">♩ <b>{props.song.bpm}</b> BPM</span>}
          {props.song.timeSignature && <span className="fact">𝄞 <b>{props.song.timeSignature}</b></span>}
          {time && <span className="fact" data-testid="sing-time" title={t("Estimated sing time")}>◷ <b>{time}</b></span>}
        </p>
        {props.song.recommendedKey && (
          <p className="rec-key" data-testid="recommended-key">
            {t("Recommended key")} <b>{props.song.recommendedKey}</b>{props.song.recommendedKeyReason ? ` — ${props.song.recommendedKeyReason}` : ""}
          </p>
        )}
      </div>
      <div className="hero-actions">
        {props.leadHref && <Link className="btn btn-primary btn-block" data-testid="lead-worship" to={props.leadHref}><PlayIcon />{t("Lead worship")}</Link>}
        <div className="row">
          <AddToSetlist song={props.song} />
          <button type="button" className={"btn btn-ghost btn-icon" + (props.inLibrary ? " on" : "")} data-testid="library-toggle" aria-pressed={props.inLibrary} title={props.inLibrary ? t("Saved") : t("Save song")} onClick={props.onToggleLibrary}>
            <HeartIcon on={props.inLibrary} />
            <span className="sr-only">{props.inLibrary ? t("Saved") : t("Save song")}</span>
          </button>
        </div>
        {supportLinks.length > 0 && <SupportWriter links={supportLinks} writer={props.song.writer} />}
      </div>
    </section>
  );
};
