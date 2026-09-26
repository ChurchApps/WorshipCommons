import React, { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth";
import { uploadFile, wcGet, wcPost, wcPut } from "../api";
import { SongForm, blankSong, conventionalName, FILE_LABEL, hasRecording, payloadFrom, SongFiles, SongFormValues, songFromPayload } from "../components/SongForm";
import "../styles/upload.css";
import { usePageMeta } from "../seo";
import { useI18n, SONG_LANG } from "../i18n";

export const Upload: React.FC = () => {
  const { t, lang } = useI18n();
  usePageMeta(t("Share your song — WorshipCommons"));
  const { user } = useAuth();
  const location = useLocation();
  const [params] = useSearchParams();
  const draftParam = params.get("draft") || "";
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [initial, setInitial] = useState<SongFormValues | null>(draftParam ? null : blankSong(SONG_LANG[lang]));
  // the reviewer's note when a draft came back with "changes requested"
  const [reviewNote, setReviewNote] = useState("");
  const [attached, setAttached] = useState<string[]>([]);
  const draftIdRef = useRef<string | null>(draftParam || null);
  const creatingRef = useRef<Promise<string> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!user || !draftParam) return;
    let live = true;
    wcGet(`/submissions/${draftParam}`, true).then(sub => {
      if (!live) return;
      const payload = sub.payload || sub;
      const values = songFromPayload(payload);
      values.recordingOwned = !!payload?.detail?.recordingOwned;
      draftIdRef.current = sub.id || sub.submissionId || draftParam;
      setReviewNote(sub.reviewReason === "changes" && sub.reviewNote ? sub.reviewNote : "");
      setAttached((sub.files || []).filter((f: { action?: string }) => f.action !== "remove").map((f: { name: string }) => f.name));
      setInitial(values);
    }).catch(err => {
      if (!live) return;
      draftIdRef.current = null;
      setError((err as Error).message);
      setInitial(blankSong(SONG_LANG[lang]));
    });
    return () => { live = false; };
  }, [user, draftParam, lang]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;

  const ensureDraft = (form: SongFormValues, hasDemo: boolean) => {
    if (draftIdRef.current) return Promise.resolve(draftIdRef.current);
    if (creatingRef.current) return creatingRef.current;
    creatingRef.current = wcPost("/submissions", { assetType: "song", payload: payloadFrom(form, hasDemo) }, true)
      .then(d => {
        draftIdRef.current = d.submissionId;
        // a reload reopens this draft instead of starting another; replaceState so the router doesn't reload it now
        window.history.replaceState(window.history.state, "", `${location.pathname}?draft=${encodeURIComponent(d.submissionId)}`);
        return d.submissionId as string;
      })
      .finally(() => { creatingRef.current = null; });
    return creatingRef.current;
  };

  const handleFormChange = (form: SongFormValues) => {
    if (busyRef.current || form.title.trim().length < 2) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const hadId = !!draftIdRef.current;
      const saved = () => setSaveStatus(t("Draft saved {time}", { time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) }));
      ensureDraft(form, false).then(id => {
        if (!hadId) return saved();
        return wcPut(`/submissions/${id}`, { payload: payloadFrom(form, false) }, true).then(saved);
      }).catch(() => setSaveStatus(t("Not saved — check your connection")));
    }, 1000);
  };

  const handleSubmit = async (form: SongFormValues, files: SongFiles) => {
    if (busyRef.current) return;
    setError("");
    if (hasRecording(files) && !form.recordingOwned) {
      setError(t("Please confirm you own this recording (or have the owner's permission to share it)."));
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    busyRef.current = true;
    setBusy(true);
    setProgress("");
    try {
      const id = await ensureDraft(form, hasRecording(files));
      await wcPut(`/submissions/${id}`, { payload: payloadFrom(form, hasRecording(files)) }, true);
      for (const [role, file] of Object.entries(files)) {
        if (!file) continue;
        const name = t(FILE_LABEL[role] || role);
        setProgress(t("Uploading {name}…", { name }));
        await uploadFile(id, file, conventionalName(role, file), pct => setProgress(t("Uploading {name}… {pct}%", { name, pct: Math.round(pct) })));
      }
      setProgress("");
      await wcPost(`/submissions/${id}/submit`, {}, true);
      setSubmitted(true);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError((err as Error).message);
      setProgress("");
      // keep the draft so they can continue — do not delete on failure
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <main className="wrap-narrow">
        <div className="thanks card show" data-testid="upload-thanks">
          <span className="free-badge">{t("Received")}</span>
          <h2 style={{ marginTop: 16 }}>{t("Thank you — it’s in review")}</h2>
          <p>{t("A human reviews every song — usually within a few days. Track it on")} <Link to="/my-songs">{t("My submissions")}</Link>. {t("The church will be glad to sing it.")}</p>
          <div className="thanks-actions">
            <Link to="/my-songs" className="btn btn-primary">{t("My submissions")}</Link>
            <Link to="/songs" className="btn btn-ghost">{t("Back to the library")}</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="wrap-narrow">
      <div className="page-head">
        <span className="eyebrow">{t("Share a song")}</span>
        <h1>{t("Give the church something to sing")}</h1>
        <p className="lede">{t("Four quick steps: the song, its files, what you’re giving, and your word that it’s yours to give. A human reviews every song before it goes live — usually within a few days. Prefer to release a song without uploading it?")} <Link to="/license#release">{t("Copy the release notice.")}</Link></p>
      </div>

      {!initial && <p>{t("Loading…")}</p>}
      {reviewNote && (
        <div className="dup-warning" data-testid="changes-requested">
          <b>{t("A reviewer asked for changes before this can go live:")}</b>
          <p style={{ marginTop: 6 }}>{reviewNote}</p>
          <p className="hint" style={{ marginTop: 6 }}>{t("Make the changes below, then press “Add it to the commons” to send it again.")}</p>
        </div>
      )}
      {initial && (
        <SongForm
          initial={initial}
          error={error}
          busy={busy}
          busyLabel="Uploading…"
          progress={progress}
          saveStatus={saveStatus}
          submitLabel="Add it to the commons"
          submitHint="Reviewed by a human before it appears — usually within a few days."
          onChange={handleFormChange}
          onSubmit={handleSubmit}
          attached={attached}
        />
      )}
    </main>
  );
};
