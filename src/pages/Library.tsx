import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loadSongs, Song } from "../songs";
import { libraryIds, toggleLibrary } from "../library";
import { usePageMeta } from "../seo";
import { useI18n } from "../i18n";

export default function Library() {
  const { t } = useI18n();
  usePageMeta(t("Your library — WorshipCommons"));
  const [songs, setSongs] = useState<Song[] | null>(null);

  useEffect(() => {
    const ids = libraryIds();
    loadSongs().then(all => setSongs(ids.map(id => all.find(s => s.id === id)).filter(Boolean) as Song[]));
  }, []);

  const remove = (id: string) => {
    toggleLibrary(id);
    setSongs(s => s!.filter(x => x.id !== id));
  };

  return (
    <main className="wrap-narrow">
      <div className="page-head">
        <span className="eyebrow">{t("Your library")}</span>
        <h1>{t("Songs you’ve saved")}</h1>
        <p className="lede">{t("Saved on this device — no account needed.")}</p>
      </div>

      {!songs && <p>{t("Loading…")}</p>}
      {songs?.length === 0 && (
        <div className="card" style={{ padding: 32, textAlign: "center" }} data-testid="library-empty">
          <p style={{ marginBottom: 16 }}>{t("Nothing here yet.")}</p>
          <Link to="/songs" className="btn btn-primary">{t("Explore the songs")}</Link>
        </div>
      )}
      {songs?.map(s => (
        <div className="card" key={s.id} style={{ padding: 24, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }} data-testid="library-song">
          <div>
            <h3 style={{ marginBottom: 4 }}><Link to={`/songs/${s.id}`}>{s.title}</Link></h3>
            <p className="hint">{s.writer} · {s.year} · {t("Key")} {s.songKey}</p>
          </div>
          <button className="btn btn-ghost" data-testid="library-remove" onClick={() => remove(s.id)}>{t("Remove")}</button>
        </div>
      ))}
    </main>
  );
}
