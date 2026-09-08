import { Link } from "react-router-dom";
import { HistoryEntry, Song, themeList } from "../songs";
import { titlesMatch } from "../abc";
import { useI18n } from "../i18n";
import RightsPanel from "./RightsPanel";

const ArrowRight = () => (
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
  family: Song[];
  similar: (Song & { reason?: string })[];
  history: HistoryEntry[];
  writerHref: string;
}

// Author, scripture, topics, the song's family in the commons, what else this tune has carried, similar songs,
// who contributed, and the rights matrix — everything that answers "where does this come from and may we use it".
export default function AboutPanel({ song, family, similar, history, writerHref }: Props) {
  const { t } = useI18n();
  const parent = family.find(f => f.id === song.parentSongId) || null;
  const relatives = family.filter(f => f.id !== song.id && f.id !== parent?.id);
  // ponytail: "other texts this tune has carried" = same-language family members with a different title; a translation
  // also differs in title but lives in another language, so the language check keeps the two lists apart
  const tuneTexts = family.filter(f => f.id !== song.id && f.language === song.language && !titlesMatch(f.title, song.title));
  const tuneSwap = similar.filter(s => song.meter && s.meter === song.meter && (s.parentSongId || s.id) !== (song.parentSongId || song.id));
  const themes = themeList(song);
  const contributors = song.contributors || [];

  const rowSub = (r: Song) => r.relationLabel || `${r.writer}, ${r.year}`;

  return (
    <div className="about-panel" data-testid="panel-about">
      <section className="about-writer">
        {(song.writerPortraitUrl || song.writerBio)
          ? (
            <div data-testid="about-the-writer">
              <h2>{t("About the writer")}</h2>
              <div className="writer-row">
                {song.writerPortraitUrl && <img className="writer-photo" src={song.writerPortraitUrl} alt={t("Portrait of {writer}", { writer: song.writer })} loading="lazy" />}
                <div>
                  <Link to={writerHref}><b>{song.writer}</b></Link>
                  {song.writerBio && <p className="writer-bio" data-testid="song-writer-bio">{song.writerBio}</p>}
                </div>
              </div>
              <p className="writer-src">{song.writerPortraitUrl ? t("Portrait & bio via Wikipedia (CC BY-SA).") : t("Bio via Wikipedia (CC BY-SA).")}</p>
            </div>
          )
          : (
            <p className="about-line"><b>{t("Writer")}</b> <Link to={writerHref}>{song.writer}</Link>{song.year ? `, ${song.year}` : ""}</p>
          )}
        {(song.scriptureText || song.scripture) && (
          <p className="epigraph" data-testid="about-scripture">
            {song.scriptureText
              ? <><b>{song.scriptureText.replace(/ — .*$/, "")}</b>{song.scripture ? ` — ${song.scripture}` : ""}</>
              : song.scripture}
          </p>
        )}
        {themes.length > 0 && (
          <p className="about-line"><b>{t("Themes")}</b> {themes.map((th, i) => <span key={th}>{i > 0 && ", "}<Link to={`/songs?theme=${encodeURIComponent(th)}`}>{th}</Link></span>)}</p>
        )}
        {song.meter && <p className="about-line"><b>{t("Meter")}</b> <Link to={`/songs?meter=${encodeURIComponent(song.meter)}`}>{song.meter}</Link>{song.tune ? ` · ${song.tune}` : ""}</p>}
        {(song.hymnalCount ?? 0) > 0 && <p className="about-line" data-testid="hymnal-count">{t("In {n} hymnals", { n: song.hymnalCount as number })}</p>}
      </section>

      {(parent || relatives.length > 0) && (
        <section>
          <h2>{t("In the commons")}</h2>
          <ul className="rel-list" data-testid="family-list">
            {parent && <li><div><Link to={`/songs/${parent.id}`}>{parent.title}</Link><span>{t("Original")} · {parent.writer}, {parent.year}</span></div><ArrowRight /></li>}
            {relatives.map(r => <li key={r.id}><div><Link to={`/songs/${r.id}`}>{r.title}</Link><span>{rowSub(r)}</span></div><ArrowRight /></li>)}
          </ul>
        </section>
      )}

      {tuneTexts.length > 0 && (
        <section>
          <h2>{t("Other texts this tune has carried")}</h2>
          <ul className="rel-list" data-testid="tune-texts">
            {tuneTexts.map(r => <li key={r.id}><div><Link to={`/songs/${r.id}`}>{r.title}</Link><span>{rowSub(r)}</span></div><ArrowRight /></li>)}
          </ul>
        </section>
      )}

      {similar.length > 0 && (
        <section>
          <h2>{t("Similar songs")}</h2>
          <ul className="rel-list" data-testid="similar-songs">
            {similar.map(s => <li key={s.id}><div><Link to={`/songs/${s.id}`}>{s.title}</Link><span>{s.writer}{s.reason ? ` · ${s.reason}` : ""}</span></div><ArrowRight /></li>)}
          </ul>
        </section>
      )}

      {tuneSwap.length > 0 && (
        <section>
          <h2>{t("Sing it to another tune")}</h2>
          <p className="rel-hint" style={{ marginTop: 0 }}>{t("Same meter ({meter}) — these tunes carry this text.", { meter: song.meter as string })}</p>
          <ul className="rel-list" data-testid="tune-swap">
            {tuneSwap.map(s => <li key={s.id}><div><Link to={`/songs/${s.id}`}>{s.title}</Link><span>{s.writer}</span></div><ArrowRight /></li>)}
          </ul>
        </section>
      )}

      {(contributors.length > 0 || history.length > 0) && (
        <section data-testid="history">
          <h2>{t("Contributors & changes")}</h2>
          {contributors.length > 0 && (
            <ul className="contributors" data-testid="contributors">
              {contributors.map((c, i) => <li key={`${c.name}-${i}`}><b>{c.name}</b> <span>{t(c.what)}{c.at ? ` · ${new Date(c.at).toLocaleDateString()}` : ""}</span></li>)}
            </ul>
          )}
          {history.length > 0 && (
            <ul className="rel-list">
              {history.map(h => (
                <li key={h.submissionId} data-testid="history-entry">
                  <div>
                    <b>{h.submittedByName || t("a community member")}</b>
                    <span>{h.approvedAt ? new Date(h.approvedAt).toLocaleDateString() : ""}{h.note ? ` · ${h.note}` : ""}{h.filesChanged?.length ? ` · ${h.filesChanged.map(f => t(fileChangeLabel(f.name))).join(", ")}` : ""}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="rel-hint">{t("Anyone signed in can propose an edit; a reviewer decides.")}</p>
        </section>
      )}

      <RightsPanel song={song} />

      <p className="rel-hint">{t("Made an arrangement or translation?")} <Link to="/upload">{t("Add it back.")}</Link></p>
    </div>
  );
}
