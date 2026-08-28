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
  rejected: { label: "Not accepted", note: "This one didn't make it into the library. Questions? support@worshipcommons.org" },
  withdrawn: { label: "Withdrawn", note: "You pulled this one back before it was reviewed." }
};

const REVIEW_REASONS: Record<string, string> = {
  quality: "The review team felt this one isn’t ready for the library yet.",
  duplicate: "This looks like a song that’s already in the library.",
  licensing: "There’s a rights or licensing issue with this submission.",
  offtopic: "This doesn’t fit the worship-song library.",
  incomplete: "This submission is missing something we need to publish it.",
  other: "This one didn’t make it into the library."
};

export default function MySongs() {
  const { t } = useI18n();
  usePageMeta(t("My songs — WorshipCommons"));
  const { user } = useAuth();
  const location = useLocation();
  const [subs, setSubs] = useState<Submission[] | null>(null);
  const [downloads, setDownloads] = useState<Record<string, number>>({});
  const [copied, setCopied] = useState("");

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
        const count = downloads[s.assetId] ?? 0;
        const liveUrl = s.status === "approved" && s.assetId ? `${window.location.origin}/songs/${s.assetId}` : "";
        const reason = s.reviewReason ? t(REVIEW_REASONS[s.reviewReason] || REVIEW_REASONS.other) : "";
        return (
          <div className="card" key={s.id} style={{ padding: 24, marginBottom: 16 }} data-testid="my-song">
            <h3 style={{ marginBottom: 4 }}>
              {s.status === "approved" ? <Link to={`/songs/${s.assetId}`}>{s.assetName}</Link> : s.assetName}
              <span className={s.status === "approved" ? "free-badge" : "pd-badge"} style={{ marginLeft: 10 }} data-testid="my-song-status">{t(st.label)}</span>
            </h3>
            <p className="hint" style={{ marginBottom: 8 }}>{detail.writer}{detail.songKey ? ` · ${t("Key")} ${detail.songKey}` : ""}{s.note ? ` · ${s.note}` : ""}{s.createdAt ? t(" · submitted {date}", { date: new Date(s.createdAt).toLocaleDateString() }) : ""}</p>
            <p style={{ fontSize: "0.9375rem" }}>{t(st.note)}{s.status === "approved" ? t(" {count} downloads.", { count: count.toLocaleString() }) : ""}</p>
            {liveUrl && (
              <p className="hint" style={{ marginTop: 10, marginBottom: 0, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", wordBreak: "break-all" }}>
                <a href={liveUrl} data-testid="my-song-url">{liveUrl}</a>
                <button type="button" className="btn btn-ghost" data-testid="copy-song-link" style={{ padding: "6px 14px", minHeight: 0, fontSize: "0.8125rem" }} onClick={async () => {
                  await navigator.clipboard.writeText(liveUrl);
                  setCopied(s.id);
                  setTimeout(() => setCopied(""), 1500);
                }}>{copied === s.id ? t("Copied ✓") : t("Copy link")}</button>
              </p>
            )}
            {s.status === "rejected" && (reason || s.reviewNote) && (
              <p style={{ fontSize: "0.9375rem", marginTop: 8 }} data-testid="review-note">{reason}{reason && s.reviewNote ? " — " : ""}{s.reviewNote}</p>
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
