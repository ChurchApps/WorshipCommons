import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import { wcGet, wcPost } from "../api";
import { usePageMeta } from "../seo";
import { useI18n } from "../i18n";

interface Submission {
  id: string;
  assetId: string;
  assetName: string;
  status: string;
  note?: string;
  reviewReason?: string;
  reviewNote?: string;
  payload?: { detail?: Record<string, any> };
  submittedAt?: string;
  createdAt?: string;
}

const STATUS: Record<string, { label: string; note: string }> = {
  draft: { label: "Draft", note: "Not sent yet." },
  pending: { label: "In review", note: "A human reads every song before it goes live — usually within a few days." },
  approved: { label: "Live", note: "In the library, free for churches to sing." },
  rejected: { label: "Not accepted", note: "This one didn't make it into the library. Questions? support@churchapps.org" },
  withdrawn: { label: "Withdrawn", note: "You pulled this one back before it was reviewed." }
};

export default function MySongs() {
  const { t } = useI18n();
  usePageMeta(t("My songs — WorshipCommons"));
  const { user } = useAuth();
  const location = useLocation();
  const [subs, setSubs] = useState<Submission[] | null>(null);
  const [downloads, setDownloads] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    const [mine, assets] = await Promise.all([wcGet("/submissions/mine", true), wcGet("/assets/mine", true).catch((): { id: string; downloadCount: number }[] => [])]);
    setSubs(mine || []);
    setDownloads(Object.fromEntries((assets || []).map((a: { id: string; downloadCount: number }) => [a.id, a.downloadCount])));
  }, []);

  useEffect(() => { if (user) load().catch(() => setSubs([])); }, [user, load]);

  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;

  const withdraw = async (id: string) => {
    await wcPost(`/submissions/${id}/withdraw`, {}, true);
    load();
  };

  return (
    <main className="wrap-narrow">
      <div className="page-head">
        <span className="eyebrow">{t("My songs")}</span>
        <h1>{t("What you’ve shared")}</h1>
        <p className="lede">{t("Every song you’ve submitted and where it stands.")}</p>
      </div>

      {!subs && <p>{t("Loading…")}</p>}
      {subs?.length === 0 && (
        <div className="card" style={{ padding: 32, textAlign: "center" }} data-testid="no-submissions">
          <p style={{ marginBottom: 16 }}>{t("Nothing here yet.")}</p>
          <Link to="/upload" className="btn btn-primary">{t("Share your first song")}</Link>
        </div>
      )}
      {subs?.map(s => {
        const st = STATUS[s.status] || STATUS.pending;
        const detail = s.payload?.detail || {};
        const count = downloads[s.assetId] || 0;
        return (
          <div className="card" key={s.id} style={{ padding: 24, marginBottom: 16 }} data-testid="my-song">
            <h3 style={{ marginBottom: 4 }}>
              {s.status === "approved" ? <Link to={`/songs/${s.assetId}`}>{s.assetName}</Link> : s.assetName}
              <span className={s.status === "approved" ? "free-badge" : "pd-badge"} style={{ marginLeft: 10 }} data-testid="my-song-status">{t(st.label)}</span>
            </h3>
            <p className="hint" style={{ marginBottom: 8 }}>{detail.writer}{detail.songKey ? ` · ${t("Key")} ${detail.songKey}` : ""}{s.note ? ` · ${s.note}` : ""}{s.createdAt ? t(" · submitted {date}", { date: new Date(s.createdAt).toLocaleDateString() }) : ""}</p>
            <p style={{ fontSize: "0.9375rem" }}>{t(st.note)}{s.status === "approved" && count > 0 ? t(" {count} downloads.", { count: count.toLocaleString() }) : ""}</p>
            {s.status === "rejected" && (s.reviewReason || s.reviewNote) && (
              <p style={{ fontSize: "0.9375rem", marginTop: 8 }} data-testid="review-note"><b>{s.reviewReason}</b>{s.reviewReason && s.reviewNote ? " — " : ""}{s.reviewNote}</p>
            )}
            {s.status === "pending" && (
              <button className="btn btn-ghost" style={{ marginTop: 12 }} data-testid="withdraw" onClick={() => withdraw(s.id)}>{t("Withdraw")}</button>
            )}
          </div>
        );
      })}
    </main>
  );
}
