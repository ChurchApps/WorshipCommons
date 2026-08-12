import { useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import { wcGet } from "../api";
import { Song } from "../songs";
import { usePageMeta } from "../seo";

const STATUS: Record<string, { label: string; note: string }> = {
  pending: { label: "In review", note: "A human reads every song before it goes live — usually within a few days." },
  approved: { label: "Live", note: "In the library, free for churches to sing." },
  removed: { label: "Not accepted", note: "This one didn't make it into the library. Questions? support@churchapps.org" }
};

export default function MySongs() {
  usePageMeta("My songs — WorshipCommons");
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
        <span className="eyebrow">My songs</span>
        <h1>What you&apos;ve shared</h1>
        <p className="lede">Every song you&apos;ve submitted and where it stands.</p>
      </div>

      {!songs && <p>Loading…</p>}
      {songs?.length === 0 && (
        <div className="card" style={{ padding: 32, textAlign: "center" }} data-testid="no-submissions">
          <p style={{ marginBottom: 16 }}>Nothing here yet.</p>
          <Link to="/upload" className="btn btn-primary">Share your first song</Link>
        </div>
      )}
      {songs?.map(s => {
        const st = STATUS[s.status || "pending"] || STATUS.pending;
        return (
          <div className="card" key={s.id} style={{ padding: 24, marginBottom: 16 }} data-testid="my-song">
            <h3 style={{ marginBottom: 4 }}>
              {s.status === "approved" ? <Link to={`/songs/${s.id}`}>{s.title}</Link> : s.title}
              <span className={s.status === "approved" ? "free-badge" : "pd-badge"} style={{ marginLeft: 10 }} data-testid="my-song-status">{st.label}</span>
            </h3>
            <p className="hint" style={{ marginBottom: 8 }}>{s.writer} · Key {s.songKey}{s.bpm ? ` · ${s.bpm} BPM` : ""}{s.createdAt ? ` · submitted ${new Date(s.createdAt).toLocaleDateString()}` : ""}</p>
            <p style={{ fontSize: "0.9375rem" }}>{st.note}{s.status === "approved" && s.churchCount > 0 ? ` ${s.churchCount.toLocaleString()} churches sing it.` : ""}</p>
          </div>
        );
      })}
    </main>
  );
}
