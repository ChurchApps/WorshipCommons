import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loadSongs, Song, songRecency } from "../songs";
import { usePageMeta } from "../seo";
import { useI18n } from "../i18n";

// Only songs carrying a real publish/create date belong on a changelog — songRecency
// falls back to the copyright year, which would file 1763 hymns under January 1970.
const published = (s: Song) => !Number.isNaN(Date.parse(s.publishedAt || s.createdAt || ""));

// a changelog, not a second library — /songs is the browsable, filterable, paged view
const LIMIT = 100;

type Month = { label: string; songs: Song[] };

function byMonth(songs: Song[], lang: string): Month[] {
  const months: Month[] = [];
  for (const song of songs) {
    const label = new Date(songRecency(song)).toLocaleDateString(lang, { month: "long", year: "numeric" });
    if (months[months.length - 1]?.label !== label) months.push({ label, songs: [] });
    months[months.length - 1].songs.push(song);
  }
  return months;
}

export default function New() {
  const { t, lang } = useI18n();
  usePageMeta(t("New songs — WorshipCommons"), t("Every song added to the commons, newest first."));
  const [songs, setSongs] = useState<Song[] | null>(null);
  useEffect(() => { loadSongs().then(all => setSongs(all.filter(published).sort((a, b) => songRecency(b) - songRecency(a)).slice(0, LIMIT))).catch(() => setSongs([])); }, []);

  return (
    <main className="wrap-narrow">
      <div className="page-head">
        <span className="eyebrow">{t("Recently added")}</span>
        <h1>{t("New songs")}</h1>
        <p className="lede">{t("Every song added to the commons, newest first.")}</p>
      </div>

      {!songs && <p>{t("Loading…")}</p>}
      {songs?.length === 0 && <p data-testid="new-empty">{t("No songs found")}</p>}

      <div data-testid="new-songs">
        {songs && byMonth(songs, lang).map(month => (
          <section key={month.label}>
            <h2 data-testid="new-month" style={{ margin: "32px 0 12px", fontSize: "0.9375rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>{month.label}</h2>
            <ul style={{ listStyle: "none" }}>
              {month.songs.map(s => (
                <li key={s.id} className="card" style={{ padding: 20, marginBottom: 12 }} data-testid="new-song">
                  <h3 style={{ marginBottom: 4 }}><Link to={`/songs/${s.id}`}>{s.title}</Link></h3>
                  <p className="hint">
                    {s.writer}
                    {" · "}{s.license === "WC" ? t("Free for worship") : t("Public domain")}
                    {" · "}{s.language}
                    {" · "}{new Date(songRecency(s)).toLocaleDateString(lang, { year: "numeric", month: "long", day: "numeric" })}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {songs && songs.length >= LIMIT && <p style={{ margin: "24px 0 48px" }}><Link to="/songs">{t("Browse all songs")}</Link></p>}
    </main>
  );
}
