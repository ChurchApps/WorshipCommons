import { useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import { uploadFile, wcDelete, wcPost } from "../api";
import SongForm, { blankSong, conventionalName, payloadFrom, SongFiles, SongFormValues } from "../components/SongForm";
import "../styles/upload.css";
import { usePageMeta } from "../seo";
import { useI18n, SONG_LANG } from "../i18n";

export default function Upload() {
  const { t, lang } = useI18n();
  usePageMeta(t("Share your song — WorshipCommons"));
  const { user } = useAuth();
  const location = useLocation();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;

  const submit = async (form: SongFormValues, files: SongFiles) => {
    setError("");
    if (files.demoAudio && !form.recordingOwned) {
      setError(t("Please confirm you own this recording (or have the owner's permission to share it)."));
      return;
    }
    let id = "";
    try {
      const draft = await wcPost("/submissions", { assetType: "song", payload: payloadFrom(form, !!files.demoAudio) }, true);
      id = draft.submissionId;
      for (const [role, file] of Object.entries(files)) if (file) await uploadFile(id, file, conventionalName(role, file));
      await wcPost(`/submissions/${id}/submit`, {}, true);
      setSubmitted(true);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError((err as Error).message);
      // start clean next attempt — a leftover draft would keep its half-uploaded files
      if (id) await wcDelete(`/submissions/${id}`, true).catch(() => {});
    }
  };

  if (submitted) {
    return (
      <main className="wrap-narrow">
        <div className="thanks card show" data-testid="upload-thanks">
          <span className="free-badge">{t("Received")}</span>
          <h2 style={{ marginTop: 16 }}>{t("Thank you — it’s in review")}</h2>
          <p>{t("A human reviews every song — usually within a few days. Track it on")} <Link to="/my-songs">{t("My songs")}</Link>. {t("The church will be glad to sing it.")}</p>
          <div className="thanks-actions">
            <Link to="/my-songs" className="btn btn-primary">{t("My songs")}</Link>
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

      <SongForm
        initial={blankSong(SONG_LANG[lang])}
        error={error}
        submitLabel="Add it to the commons"
        submitHint="Reviewed by a human before it appears — usually within a few days."
        onSubmit={submit}
      />
    </main>
  );
}
