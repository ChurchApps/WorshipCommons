import React from "react";
import { Link } from "react-router-dom";
import { HistoryEntry, Song, themeList, songPath } from "../songs";
import { useI18n } from "../i18n";
import { RightsPanel } from "./RightsPanel";
import { acceptsProposals, licenseById } from "../licenses";
import SourcesPanel from "./SourcesPanel";

const ArrowRight: React.FC = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);

const FILE_LABELS: [RegExp, string][] = [
  [/^demoAudio\./i, "demo recording"],
  [/^sheetPdf\./i, "sheet music"],
  [/^stemsZip\./i, "multitracks"],
  [/^tune\.abc$/i, "notation"],
  [/^score\./i, "score"],
  [/^lyrics\./i, "lyrics"]
];
const fileChangeLabel = (name: string) => FILE_LABELS.find(([re]) => re.test(name))?.[1] || name;

interface Props {
  song: Song;
  similar: (Song & { reason?: string })[];
  history: HistoryEntry[];
  writerHref: string;
}

// Author, scripture, topics, other tunes for this text, who contributed, and the rights matrix — everything that
// answers "where does this come from and may we use it". Family and similar titles sit at the foot of the song page.
export const AboutPanel: React.FC<Props> = (props) => {
  const { t } = useI18n();
  const tuneSwap = props.similar.filter(s => props.song.meter && s.meter === props.song.meter && (s.parentSongId || s.id) !== (props.song.parentSongId || props.song.id));
  const themes = themeList(props.song);
  const contributors = props.song.contributors || [];


  return (
    <div className="about-panel" data-testid="panel-about">
      <section className="about-writer">
        {(props.song.writerPortraitUrl || props.song.writerBio)
          ? (
            <div data-testid="about-the-writer">
              <h2>{t("About the writer")}</h2>
              <div className="writer-row">
                {props.song.writerPortraitUrl && <img className="writer-photo" src={props.song.writerPortraitUrl} alt={t("Portrait of {writer}", { writer: props.song.writer })} loading="lazy" />}
                <div>
                  <Link to={props.writerHref}><b>{props.song.writer}</b></Link>
                  {props.song.writerBio && <p className="writer-bio" data-testid="song-writer-bio">{props.song.writerBio}</p>}
                </div>
              </div>
              <p className="writer-src">{props.song.writerPortraitUrl ? t("Portrait & bio via Wikipedia (CC BY-SA).") : t("Bio via Wikipedia (CC BY-SA).")}</p>
            </div>
          )
          : (
            <p className="about-line"><b>{t("Writer")}</b> <Link to={props.writerHref}>{props.song.writer}</Link>{props.song.year ? `, ${props.song.year}` : ""}</p>
          )}
        {(props.song.scriptureText || props.song.scripture) && (
          <p className="epigraph" data-testid="about-scripture">
            {props.song.scriptureText
              ? <><b>{props.song.scriptureText.replace(/ — .*$/, "")}</b>{props.song.scripture ? ` — ${props.song.scripture}` : ""}</>
              : props.song.scripture}
          </p>
        )}
        {themes.length > 0 && (
          <p className="about-line"><b>{t("Themes")}</b> {themes.map((th, i) => <span key={th}>{i > 0 && ", "}<Link to={`/songs?theme=${encodeURIComponent(th)}`}>{th}</Link></span>)}</p>
        )}
        {props.song.meter && <p className="about-line"><b>{t("Meter")}</b> <Link to={`/songs?meter=${encodeURIComponent(props.song.meter)}`}>{props.song.meter}</Link>{props.song.tune ? ` · ${props.song.tune}` : ""}</p>}
        {(props.song.hymnalCount ?? 0) > 0 && <p className="about-line" data-testid="hymnal-count">{t("In {n} hymnals", { n: props.song.hymnalCount as number })}</p>}
      </section>

      {tuneSwap.length > 0 && (
        <section>
          <h2>{t("Sing it to another tune")}</h2>
          <p className="rel-hint" style={{ marginTop: 0 }}>{t("Same meter ({meter}) — these tunes carry this text.", { meter: props.song.meter as string })}</p>
          <ul className="rel-list" data-testid="tune-swap">
            {tuneSwap.map(s => <li key={s.id}><div><Link to={songPath(s)}>{s.title}</Link><span>{s.writer}</span></div><ArrowRight /></li>)}
          </ul>
        </section>
      )}

      {(contributors.length > 0 || props.history.length > 0) && (
        <section data-testid="history">
          <h2>{t("Contributors & changes")}</h2>
          {contributors.length > 0 && (
            <ul className="contributors" data-testid="contributors">
              {contributors.map((c, i) => <li key={`${c.name}-${i}`}><b>{c.name}</b> <span>{t(c.what)}{c.at ? ` · ${new Date(c.at).toLocaleDateString()}` : ""}</span></li>)}
            </ul>
          )}
          {props.history.length > 0 && (
            <ul className="rel-list">
              {props.history.map(h => (
                <li key={h.submissionId} data-testid="history-entry">
                  <div>
                    <b>{h.submittedByName || t("a community member")}</b>
                    <span>{h.approvedAt ? new Date(h.approvedAt).toLocaleDateString() : ""}{h.note ? ` · ${h.note}` : ""}{h.filesChanged?.length ? ` · ${h.filesChanged.map(f => t(fileChangeLabel(f.name))).join(", ")}` : ""}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {acceptsProposals(props.song) && <p className="rel-hint">{t("Anyone signed in can propose an edit; a reviewer decides.")}</p>}
        </section>
      )}

      <SourcesPanel song={props.song} />

      <RightsPanel song={props.song} />

      {/* only invite derivatives the composed rights actually allow (every layer must allow sharing one; custom and ND grants do not) */}
      {[props.song.license, ...Object.values(props.song.rights || {}).map(r => r?.license)].filter(Boolean).every(id => licenseById(id).derivativesAllowed) && <p className="rel-hint" data-testid="add-derivative">{t("Made an arrangement or translation?")} <Link to="/upload">{t("Add it back.")}</Link></p>}
    </div>
  );
};
