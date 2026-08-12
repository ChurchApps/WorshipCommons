import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import { wcGet, wcPost } from "../api";
import { Song } from "../songs";
import "../styles/songs.css";
import { usePageMeta } from "../seo";

interface AdminReport { id: string; songText: string; reporterRole: string; details: string; name: string; email: string; createdAt: string; }

// curation scratchpad: paste ABC, see the engraving live, copy the fix back to
// the git master in WorshipCommonsApi/tools/seed-assets/abc/ — nothing is saved here
function AbcWorkbench() {
  const [text, setText] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const paperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!paperRef.current) return;
    if (text.trim() === "") { paperRef.current.innerHTML = ""; setWarnings([]); return; }
    let stale = false;
    import("abcjs").then(m => {
      if (stale || !paperRef.current) return;
      const [tune] = m.default.renderAbc(paperRef.current, text, { responsive: "resize" });
      setWarnings((tune as any)?.warnings || []);
    });
    return () => { stale = true; };
  }, [text]);

  return (
    <section className="section">
      <h2 style={{ marginBottom: 6 }}>ABC workbench</h2>
      <p className="hint" style={{ marginBottom: 16 }}>Live engraving preview for catalog tune edits. Masters live in <code>WorshipCommonsApi/tools/seed-assets/abc/</code> — paste one here, fix it, copy it back. Nothing here is saved.</p>
      <div className="card" style={{ padding: 24 }}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={12}
          placeholder={"X: 1\nT: Title\nM: 4/4\nL: 1/4\nK: D\nD E F G | A4 |\nw: words go here"}
          spellCheck={false}
          data-testid="abc-editor"
          style={{ width: "100%", fontFamily: "monospace", fontSize: "0.8125rem", marginBottom: 16 }}
        />
        {warnings.length > 0 && (
          <ul style={{ color: "var(--secondary)", fontSize: "0.8125rem", marginBottom: 16 }} data-testid="abc-warnings">
            {warnings.map((w, i) => <li key={i}>{w.replace(/<[^>]+>/g, "")}</li>)}
          </ul>
        )}
        <div ref={paperRef} data-testid="abc-paper" />
      </div>
    </section>
  );
}

const quality = (s: Song) => {
  if (!s.qualityDetail) return "";
  try {
    const d = JSON.parse(s.qualityDetail);
    return `Completeness ${d.heuristic}/40 · Lyrics ${d.llm}/60${d.notes ? ` — ${d.notes}` : ""}`;
  } catch { return ""; }
};

export default function Admin() {
  usePageMeta("Admin — WorshipCommons");
  const { user } = useAuth();
  const location = useLocation();
  const [pending, setPending] = useState<Song[] | null>(null);
  const [reports, setReports] = useState<AdminReport[] | null>(null);
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    try {
      // first signed-in visitor on a fresh environment becomes the admin
      const boot = await wcPost("/admin/bootstrap", {}, true);
      if (!boot.admin) { setDenied(true); return; }
      const [songs, reps] = await Promise.all([wcGet("/admin/songs", true), wcGet("/admin/reports", true)]);
      setPending(songs);
      setReports(reps);
    } catch {
      setDenied(true);
    }
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (denied) {
    return <main className="wrap-narrow"><div className="page-head"><h1>Not authorized</h1><p className="lede">This account isn&apos;t on the review team.</p></div></main>;
  }

  const act = async (path: string) => { await wcPost(path, {}, true); load(); };

  return (
    <main className="wrap-narrow">
      <div className="page-head">
        <span className="eyebrow">Review queue</span>
        <h1>Keep the commons trustworthy</h1>
        <p className="lede">Every song gets a human read before it joins the library. Every report gets a human answer.</p>
      </div>

      <section className="section">
        <h2 style={{ marginBottom: 16 }}>Pending songs</h2>
        {!pending && <p>Loading…</p>}
        {pending?.length === 0 && <p className="hint" data-testid="no-pending">Nothing waiting — the queue is clear.</p>}
        {pending?.map(s => (
          <div className="card" key={s.id} style={{ padding: 24, marginBottom: 16 }} data-testid="pending-song">
            <h3 style={{ marginBottom: 4 }}>{s.title}{s.qualityScore != null && <span className="free-badge" style={{ marginLeft: 10 }}>Score {s.qualityScore}</span>}</h3>
            <p className="hint" style={{ marginBottom: 12 }}>{s.writer} · Key {s.songKey}{s.bpm ? ` · ${s.bpm} BPM` : ""} · {s.license === "PD" ? "Public domain" : "Free for worship"}{s.proAnswer ? ` · PRO: ${s.proAnswer}` : ""}</p>
            {quality(s) && <p className="hint" style={{ marginBottom: 12 }}>{quality(s)}</p>}
            {s.demoAudioUrl && <audio controls src={s.demoAudioUrl} style={{ width: "100%", marginBottom: 12 }} />}
            <details style={{ marginBottom: 14 }}>
              <summary>Lyrics &amp; chords</summary>
              <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.875rem", marginTop: 8 }}>{s.chordPro}</pre>
            </details>
            <div style={{ display: "flex", gap: 12 }}>
              <button className="btn btn-primary" onClick={() => act(`/admin/songs/${s.id}/approve`)}>Approve</button>
              <button className="btn btn-ghost" onClick={() => act(`/admin/songs/${s.id}/reject`)}>Reject</button>
            </div>
          </div>
        ))}
      </section>

      <section className="section">
        <h2 style={{ marginBottom: 16 }}>Open reports</h2>
        {!reports && <p>Loading…</p>}
        {reports?.length === 0 && <p className="hint" data-testid="no-reports">No open reports.</p>}
        {reports?.map(r => (
          <div className="card" key={r.id} style={{ padding: 24, marginBottom: 16 }} data-testid="open-report">
            <h3 style={{ marginBottom: 4 }}>{r.songText}</h3>
            <p className="hint" style={{ marginBottom: 8 }}>{r.reporterRole} · {r.name} · {r.email}</p>
            <p style={{ fontSize: "0.9375rem", marginBottom: 14 }}>{r.details}</p>
            <button className="btn btn-primary" onClick={() => act(`/admin/reports/${r.id}/resolve`)}>Mark resolved</button>
          </div>
        ))}
      </section>

      <AbcWorkbench />
    </main>
  );
}
