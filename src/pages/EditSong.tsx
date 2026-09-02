import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "../auth";
import { uploadFile, wcDelete, wcGet, wcPost } from "../api";
import SongForm, { conventionalName, payloadFrom, SongFiles, SongFormValues, songFromPayload } from "../components/SongForm";
import "../styles/upload.css";
import { usePageMeta } from "../seo";
import { useI18n } from "../i18n";

export default function EditSong() {
  const { t } = useI18n();
  const { id } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const [base, setBase] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const busyRef = useRef(false);

  useEffect(() => {
    if (id && user) wcGet(`/assets/${id}/editable`, true).then(setBase).catch(() => setNotFound(true));
  }, [id, user]);

  usePageMeta(base ? t("Propose an edit to {title} | WorshipCommons", { title: base.name }) : "WorshipCommons");

  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (notFound) return <main className="wrap"><p className="crumb" style={{ padding: "60px 0" }}>{t("Song not found.")} <Link to="/songs">{t("← All songs")}</Link></p></main>;

  const submit = async (form: SongFormValues, files: SongFiles, note: string) => {
    if (busyRef.current) return;
    setError("");
    busyRef.current = true;
    setBusy(true);
    setProgress("");
    let subId = "";
    const labels: Record<string, string> = { demoAudio: "demo recording", sheetPdf: "sheet music", stemsZip: "multitracks", midi: "MIDI melody", art: "cover art", thumb: "cover art" };
    try {
      const draft = await wcPost("/submissions", { assetId: id, payload: payloadFrom(form, !!files.demoAudio, base), note }, true);
      subId = draft.submissionId;
      for (const [role, file] of Object.entries(files)) {
        if (!file) continue;
        setProgress(t("Uploading {name}…", { name: t(labels[role] || role) }));
        await uploadFile(subId, file, conventionalName(role, file));
      }
      setProgress("");
      await wcPost(`/submissions/${subId}/submit`, {}, true);
      setSubmitted(true);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError((err as Error).message);
      setProgress("");
      if (subId) await wcDelete(`/submissions/${subId}`, true).catch(() => {});
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <main className="wrap-narrow">
        <div className="thanks card show" data-testid="edit-thanks">
          <span className="free-badge">{t("Received")}</span>
          <h2 style={{ marginTop: 16 }}>{t("Thank you — your edit is in review")}</h2>
          <p>{t("A reviewer compares it with what’s live and decides. Track it on")} <Link to="/my-songs">{t("My songs")}</Link>.</p>
          <Link to={`/songs/${id}`} className="btn btn-ghost">{t("← Back to song")}</Link>
        </div>
      </main>
    );
  }

  if (!base) return <main className="wrap"><p style={{ padding: "60px 0" }}>{t("Loading…")}</p></main>;

  return (
    <main className="wrap-narrow">
      <div className="page-head">
        <span className="eyebrow">{t("Propose an edit")}</span>
        <h1>{base.name}</h1>
        <p className="lede">{t("Any signed-in contributor may propose an edit — fix a chord, add a verse, correct a spelling. Nothing changes until a reviewer approves it. The original writer has no veto here; if an edit misrepresents a song, the")} <Link to="/report">{t("report form")}</Link> {t("is the way to make it right.")}</p>
      </div>

      <SongForm
        initial={songFromPayload(base)}
        noteLabel="What changed, and why?"
        error={error}
        busy={busy}
        busyLabel="Please wait…"
        progress={progress}
        submitLabel="Propose this edit"
        submitHint="A reviewer reads every edit before it goes live."
        onSubmit={submit}
      />
    </main>
  );
}
