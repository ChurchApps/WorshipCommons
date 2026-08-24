import { useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import { wcGet } from "../api";
import { Song } from "../songs";
import { usePageMeta } from "../seo";
import { useI18n } from "../i18n";

const STATUS: Record<string, { label: string; note: string }> = {
  pending: { label: "In review", note: "A human reads every song before it goes live — usually within a few days." },
  approved: { label: "Live", note: "In the library, free for churches to sing." },
  removed: { label: "Not accepted", note: "This one didn't make it into the library. Questions? support@churchapps.org" }
};

export default function MySongs() {
  const { t } = useI18n();
  usePageMeta(t("My songs — WorshipCommons"));
  const { user } = useAuth();
  const location = useLocation();
  const [songs, setSongs] = useState<Song[] | null>(null);

  useEffect(() => {
    if (user) wcGet("/songs/mine", true).then(setSongs).catch(() => setSongs([]));
  }, [user]);

  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;

  return (
    <main className="wrap-narrow">
      <div className="page-head">
        <span className="eyebrow">{t("My songs")}</span>
        <h1>{t("What you’ve shared")}</h1>
        <p className="lede">{t("Every song you’ve submitted and where it stands.")}</p>
      </div>

      {!songs && <p>{t("Loading…")}</p>}
      {songs?.length === 0 && (
        <div className="card" style={{ padding: 32, textAlign: "center" }} data-testid="no-submissions">
          <p style={{ marginBottom: 16 }}>{t("Nothing here yet.")}</p>
          <Link to="/upload" className="btn btn-primary">{t("Share your first song")}</Link>
        </div>
      )}
      {songs?.map(s => {
        const st = STATUS[s.status || "pending"] || STATUS.pending;
        return (
          <div className="card" key={s.id} style={{ padding: 24, marginBottom: 16 }} data-testid="my-song">
            <h3 style={{ marginBottom: 4 }}>
              {s.status === "approved" ? <Link to={`/songs/${s.id}`}>{s.title}</Link> : s.title}
              <span className={s.status === "approved" ? "free-badge" : "pd-badge"} style={{ marginLeft: 10 }} data-testid="my-song-status">{t(st.label)}</span>
            </h3>
            <p className="hint" style={{ marginBottom: 8 }}>{s.writer} · {t("Key")} {s.songKey}{s.bpm ? ` · ${s.bpm} BPM` : ""}{s.createdAt ? t(" · submitted {date}", { date: new Date(s.createdAt).toLocaleDateString() }) : ""}</p>
            <p style={{ fontSize: "0.9375rem" }}>{t(st.note)}{s.status === "approved" && s.downloadCount > 0 ? t(" {count} downloads.", { count: s.downloadCount.toLocaleString() }) : ""}</p>
          </div>
        );
      })}
    </main>
  );
}
