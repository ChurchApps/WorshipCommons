import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { loadSongs, Song, songFromApi, themeList } from "../songs";
import { wcGet } from "../api";
import { usePageMeta } from "../seo";
import { useI18n } from "../i18n";

const matchesWriter = (song: Song, q: string) => {
  const writer = (song.writer || "").toLowerCase();
  if (writer === q) return true;
  return writer.split(/[,&;]| and /i).map(p => p.trim()).includes(q);
};

export default function Writer() {
  const { t } = useI18n();
  const { name = "" } = useParams();
  const query = decodeURIComponent(name).trim();
  const [display, setDisplay] = useState(query);
  const [songs, setSongs] = useState<Song[] | null>(null);

  usePageMeta(display ? t("{writer} — WorshipCommons", { writer: display }) : "WorshipCommons");

  useEffect(() => {
    let live = true;
    const q = query.toLowerCase();
    const fromCatalog = (all: Song[]) => all.filter(s => matchesWriter(s, q) || s.authorId === query || s.writerId === query);

    loadSongs().then(async all => {
      try {
        const raw = await wcGet(`/authors/${encodeURIComponent(query)}`);
        if (!live) return;
        const listed: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.songs) ? raw.songs : [];
        const authorName = raw?.name || raw?.writer || query;
        setDisplay(authorName);
        if (listed.length && typeof listed[0] === "string") {
          const ids = new Set(listed);
          setSongs(all.filter(s => ids.has(s.id)));
        } else if (listed.length && typeof listed[0] === "object") {
          setSongs(listed.map(songFromApi));
        } else {
          setSongs(fromCatalog(all));
        }
      } catch {
        if (live) {
          setDisplay(query);
          setSongs(fromCatalog(all));
        }
      }
    }).catch(() => { if (live) setSongs([]); });

    return () => { live = false; };
  }, [query]);

  return (
    <main className="wrap-narrow">
      <div className="page-head">
        <span className="eyebrow">{t("Writer")}</span>
        <h1>{display || t("Writer")}</h1>
        <p className="lede">{t("Songs in the commons by this writer.")}</p>
      </div>

      {!songs && <p>{t("Loading…")}</p>}
      {songs?.length === 0 && (
        <div className="card" style={{ padding: 32, textAlign: "center" }} data-testid="writer-empty">
          <p style={{ marginBottom: 16 }}>{t("No songs found")}</p>
          <Link to={`/songs?q=${encodeURIComponent(query)}`} className="btn btn-primary">{t("Search the library")}</Link>
        </div>
      )}
      <ul data-testid="writer-songs" style={{ listStyle: "none" }}>
        {songs?.map(s => (
          <li key={s.id} className="card" style={{ padding: 24, marginBottom: 16 }} data-testid="writer-song">
            <h3 style={{ marginBottom: 4 }}><Link to={`/songs/${s.id}`}>{s.title}</Link></h3>
            <p className="hint">{s.year}{s.songKey ? ` · ${t("Key")} ${s.songKey}` : ""}{themeList(s).length ? ` · ${themeList(s).slice(0, 3).join(", ")}` : ""}{s.license === "WC" ? ` · ${t("Free for worship")}` : ` · ${t("Public domain")}`}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
