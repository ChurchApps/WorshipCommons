import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth";
import { uploadFile, wcDelete, wcGet, wcPost, wcPut } from "../api";
import SongForm, { conventionalName, FILE_LABEL, payloadFrom, PROPOSAL_TYPES, ProposalType, SongFiles, SongFormValues, songFromPayload } from "../components/SongForm";
import "../styles/upload.css";
import { usePageMeta } from "../seo";
import { useI18n } from "../i18n";

const TYPE_OPTIONS: [ProposalType, string, string][] = [
  ["correction", "Correction", "Fix lyrics, chords, or the details — with a note saying what changed and why."],
  ["additionalFile", "Additional file", "Add a score, a recording, stems, art, or a lyrics file. Nothing else changes."],
  ["removal", "Removal request", "Ask a reviewer to take this song down."]
];

const COPY: Record<ProposalType, { submit: string; hint: string; thanks: string }> = {
  correction: { submit: "Propose this edit", hint: "A reviewer reads every edit before it goes live.", thanks: "Thank you — your edit is in review" },
  additionalFile: { submit: "Propose these files", hint: "A reviewer checks every file before it joins the song.", thanks: "Thank you — your files are in review" },
  removal: { submit: "Request removal", hint: "A reviewer decides; nothing comes down until then.", thanks: "Thank you — your request is in review" }
};

const asType = (v: string | null): ProposalType | null => (PROPOSAL_TYPES as string[]).includes(v || "") ? v as ProposalType : null;

/** The payload each proposal type sends: a removal names the song and nothing more, files ride on the live payload untouched, a correction is the form. */
function proposalPayload(type: ProposalType, form: SongFormValues, files: SongFiles, base: any) {
  if (type === "removal") return { type, name: base.name, language: base.language, license: base.license, detail: { writer: base.detail?.writer, songKey: base.detail?.songKey } };
  if (type === "additionalFile") return { ...base, type, detail: { ...base.detail, certified: form.certified, recordingOwned: files.demoAudio ? form.recordingOwned : base.detail?.recordingOwned } };
  return { ...payloadFrom(form, !!files.demoAudio, base), type };
}

export default function EditSong() {
  const { t } = useI18n();
  const { id } = useParams();
  const [params] = useSearchParams();
  const draftParam = params.get("draft") || "";
  const { user } = useAuth();
  const location = useLocation();
  const [base, setBase] = useState<any>(null);
  // a draft reopened from /my-songs — its payload, note and type replace the live song as the starting point
  const [draft, setDraft] = useState<any>(null);
  const [type, setType] = useState<ProposalType>(asType(params.get("type")) || "correction");
  const [notFound, setNotFound] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const busyRef = useRef(false);
  const draftIdRef = useRef(draftParam);

  useEffect(() => {
    if (!id || !user) return;
    let live = true;
    const draftReq: Promise<any> = draftParam ? wcGet(`/submissions/${draftParam}`, true).catch((): any => null) : Promise.resolve(null);
    Promise.all([wcGet(`/assets/${id}/editable`, true), draftReq]).then(([editable, sub]) => {
      if (!live) return;
      setBase(editable);
      if (sub?.status === "draft" && sub.assetId === id) {
        setDraft(sub);
        const dt = asType(sub.type || sub.payload?.type);
        if (dt) setType(dt);
      } else {
        draftIdRef.current = "";
      }
    }).catch(() => { if (live) setNotFound(true); });
    return () => { live = false; };
  }, [id, user, draftParam]);

  usePageMeta(base ? t("Propose a change to {title} | WorshipCommons", { title: base.name }) : "WorshipCommons");

  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (notFound) return <main className="wrap"><p className="crumb" style={{ padding: "60px 0" }}>{t("Song not found.")} <Link to="/songs">{t("← All songs")}</Link></p></main>;

  const submit = async (form: SongFormValues, files: SongFiles, note: string) => {
    if (busyRef.current) return;
    setError("");
    busyRef.current = true;
    setBusy(true);
    setProgress("");
    let subId = draftIdRef.current;
    const created = !subId;
    try {
      const payload = proposalPayload(type, form, files, base);
      if (subId) {
        await wcPut(`/submissions/${subId}`, { payload, note }, true);
      } else {
        const d = await wcPost("/submissions", { assetId: id, payload, note }, true);
        subId = d.submissionId;
        draftIdRef.current = subId;
      }
      for (const [role, file] of Object.entries(files)) {
        if (!file) continue;
        setProgress(t("Uploading {name}…", { name: t(FILE_LABEL[role] || role) }));
        await uploadFile(subId, file, conventionalName(role, file));
      }
      setProgress("");
      await wcPost(`/submissions/${subId}/submit`, {}, true);
      setSubmitted(true);
      window.scrollTo({ top: 0 });
    } catch (err) {
      // the server's own words: every 400 lists what blocked the proposal
      setError((err as Error).message);
      setProgress("");
      // a draft made for this attempt goes away; a reopened one stays so Continue still works
      if (created && subId) {
        await wcDelete(`/submissions/${subId}`, true).catch(() => {});
        draftIdRef.current = "";
      }
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
          <h2 style={{ marginTop: 16 }}>{t(COPY[type].thanks)}</h2>
          <p>{t("A reviewer compares it with what’s live and decides. Track it on")} <Link to="/my-songs">{t("My songs")}</Link>.</p>
          <Link to={`/songs/${id}`} className="btn btn-ghost">{t("← Back to song")}</Link>
        </div>
      </main>
    );
  }

  if (!base) return <main className="wrap"><p style={{ padding: "60px 0" }}>{t("Loading…")}</p></main>;

  const fromDraft = draft && asType(draft.type || draft.payload?.type) === type;
  const initial = songFromPayload(fromDraft ? draft.payload : base);
  // adding files is a fresh attestation — the checkbox starts empty unless the reopened draft already carried it
  if (type === "additionalFile") initial.certified = fromDraft ? !!draft.payload?.detail?.certified : false;
  const draftFiles: string[] = fromDraft ? (draft.files || []).filter((f: any) => f.action !== "remove").map((f: any) => f.name) : [];

  return (
    <main className="wrap-narrow">
      <div className="page-head">
        <span className="eyebrow">{t("Propose a change")}</span>
        <h1>{base.name}</h1>
        <p className="lede">{t("Any signed-in contributor may propose an edit — fix a chord, add a verse, correct a spelling. Nothing changes until a reviewer approves it. The original writer has no veto here; if an edit misrepresents a song, the")} <Link to="/report">{t("report form")}</Link> {t("is the way to make it right.")}</p>
      </div>

      {draft?.reviewReason === "changes" && draft.reviewNote && (
        <div className="dup-warning" data-testid="changes-requested">
          <b>{t("A reviewer asked for changes before this can go live:")}</b>
          <p style={{ marginTop: 6 }}>{draft.reviewNote}</p>
        </div>
      )}

      <div className="field" style={{ marginTop: 24 }}>
        <label>{t("What are you proposing?")}</label>
        <div className="sub-type proposal-type" data-testid="proposal-type">
          {TYPE_OPTIONS.map(([value, label, hint]) => (
            <label key={value}>
              <input type="radio" name="proposal-type" value={value} checked={type === value} onChange={() => { setType(value); setError(""); }} />
              <span><b>{t(label)}</b><span className="hint">{t(hint)}</span></span>
            </label>
          ))}
        </div>
      </div>

      {draftFiles.length > 0 && (
        <p className="hint" data-testid="draft-files">{t("Already on this draft: {files}", { files: draftFiles.join(", ") })}</p>
      )}

      <SongForm
        key={type}
        initial={initial}
        initialNote={fromDraft ? draft.note || "" : ""}
        proposalType={type}
        error={error}
        busy={busy}
        busyLabel="Please wait…"
        progress={progress}
        submitLabel={COPY[type].submit}
        submitHint={COPY[type].hint}
        onSubmit={submit}
      />
    </main>
  );
}
