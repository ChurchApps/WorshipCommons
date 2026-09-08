import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ChordProPreview from "./ChordProPreview";
import { wcGet } from "../api";
import { parseChordPro, lintChordPro } from "../chordpro";
import { licenseById, UPLOADABLE } from "../licenses";
import { prepareArt } from "../artThumb";
import "../styles/upload.css";
import { useI18n, SONG_LANG } from "../i18n";
import { THEMES, loadSongs, Song } from "../songs";

interface SimilarSong { id: string; title: string; writer: string; }

const SONG_LANGS = Object.values(SONG_LANG);

const MAJOR_KEYS = [
  "C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"
];
const MINOR_KEYS = [
  "Cm", "C#m", "Dm", "Ebm", "Em", "Fm", "F#m", "Gm", "Abm", "Am", "Bbm", "Bm"
];

/** The three proposal types that create a package (the new-song wizard). */
export type SubmissionType = "new" | "translation" | "arrangement";
/** The three proposal types that change a published song (the edit page). */
export type ProposalType = "correction" | "additionalFile" | "removal";
export const PROPOSAL_TYPES: ProposalType[] = ["correction", "additionalFile", "removal"];
export const NEW_PACKAGE_TYPES: string[] = ["new", "translation", "arrangement"];
/** Mirrors the API's MIN_NOTE_LENGTH: a correction, file or removal proposal needs a note this long. */
export const MIN_NOTE_LENGTH = 10;

export interface SongFormValues {
  submissionType: SubmissionType;
  parentSongId: string;
  translator: string;
  arranger: string;
  title: string;
  writer: string;
  year: string;
  songKey: string;
  bpm: string;
  themes: string;
  language: string;
  scripture: string;
  chordPro: string;
  license: string;
  proAnswer: string;
  certified: boolean;
  recordingOwned: boolean;
}

export type SongFiles = { demoAudio?: File; sheetPdf?: File; stemsZip?: File; midi?: File; art?: File; thumb?: File; score?: File; scoreImage?: File; lyrics?: File };

/** Progress-line names for every upload role, keyed by SongFiles key. */
export const FILE_LABEL: Record<string, string> = { demoAudio: "demo recording", sheetPdf: "sheet music", stemsZip: "multitracks", midi: "MIDI melody", art: "cover art", thumb: "cover art", score: "score", scoreImage: "score scan", lyrics: "lyrics file" };

export const blankSong = (language: string): SongFormValues => ({ submissionType: "new", parentSongId: "", translator: "", arranger: "", title: "", writer: "", year: "", songKey: "D", bpm: "", themes: "", language, scripture: "", chordPro: "", license: "WC", proAnswer: "", certified: false, recordingOwned: false });

export const songFromPayload = (payload: any): SongFormValues => {
  const d = payload?.detail || {};
  const parentSongId = d.parentSongId || "";
  const type = payload?.type;
  return {
    // payload.type is explicit since the proposal-type contract; older drafts are inferred from the relation
    submissionType: type === "translation" || type === "arrangement" ? type : parentSongId ? (/^Translation/i.test(d.relationLabel || "") || d.translator ? "translation" : "arrangement") : "new",
    parentSongId,
    translator: d.translator || "",
    arranger: d.arranger || "",
    title: payload?.name || "",
    writer: d.writer || "",
    year: d.year ? String(d.year) : "",
    songKey: d.songKey || "D",
    bpm: d.bpm ? String(d.bpm) : "",
    themes: payload?.tags || "",
    language: payload?.language || "English",
    scripture: d.scripture || "",
    chordPro: d.chordPro || "",
    license: UPLOADABLE.some(l => l.id === payload?.license) ? payload.license : "WC",
    proAnswer: d.proAnswer || "",
    certified: true,
    recordingOwned: false
  };
};

// free text the song page shows under the related song; "" when this is a standalone song
export const relationLabelFor = (form: SongFormValues) =>
  !form.parentSongId ? "" : form.submissionType === "translation" ? `Translation (${form.language})` : form.submissionType === "arrangement" ? "Arrangement" : "";

// base keeps the fields this form doesn't edit (scriptureText, videoUrl…) when proposing an edit
export const payloadFrom = (form: SongFormValues, hasDemo: boolean, base?: any) => ({
  ...base,
  type: form.submissionType,
  name: form.title,
  tags: form.themes,
  language: form.language,
  license: form.license,
  licenseVersion: licenseById(form.license).versionDefault, // WC 1.0 · CC BY 4.0 · PD is a CC0 dedication
  attestationVersion: "1.0",
  attestedAt: new Date().toISOString(),
  detail: {
    ...base?.detail,
    writer: form.writer,
    parentSongId: form.parentSongId || undefined,
    // an edit that keeps the parent keeps whatever label the live song already carries
    relationLabel: (form.parentSongId && form.parentSongId === base?.detail?.parentSongId && base.detail.relationLabel) || relationLabelFor(form) || undefined,
    translator: form.translator.trim() || undefined,
    arranger: form.arranger.trim() || undefined,
    year: form.year ? Number(form.year) : undefined,
    songKey: form.songKey,
    bpm: form.bpm ? Number(form.bpm) : undefined,
    timeSignature: base?.detail?.timeSignature || "4/4",
    scripture: form.scripture,
    chordPro: form.chordPro,
    proAnswer: form.proAnswer,
    certified: form.certified,
    recordingOwned: hasDemo ? form.recordingOwned : base?.detail?.recordingOwned
  }
});

// a few roles have a fixed storage name in the asset registry rather than one derived from the role
const FIXED_NAMES: Record<string, string> = { midi: "tune.mid", thumb: "art-thumb.webp" };
export const conventionalName = (role: string, file: File) => {
  if (FIXED_NAMES[role]) return FIXED_NAMES[role];
  let ext = (file.name.split(".").pop() || "").toLowerCase();
  // lyrics.chordpro is the chart generated on publish — ChordPro text travels as lyrics.cho
  if (role === "lyrics" && ext === "chordpro") ext = "cho";
  return `${role}.${ext}`;
};

const parseThemes = (raw: string) => raw.split(",").map(s => s.trim()).filter(Boolean);

// first sung line — the stanza label and the [chords] are not part of it
const firstLyricLine = (chordPro: string) => (parseChordPro(chordPro)[0]?.lines[0] || []).map(s => s.text).join("").trim();

const NOTE_HEADING: Record<ProposalType, string> = {
  correction: "What changed, and why?",
  additionalFile: "About these files",
  removal: "Why should this song come down?"
};

function LicenseRecap({ churches, keep }: { churches: string[]; keep: string[] }) {
  const { t } = useI18n();
  return (
    <div className="license-recap">
      <div>
        <b>{t("Churches get:")}</b>
        <ul>{churches.map(item => <li key={item}>{item}</li>)}</ul>
      </div>
      <div>
        <b>{t("You keep:")}</b>
        <ul>{keep.map(item => <li key={item}>{item}</li>)}</ul>
      </div>
    </div>
  );
}

function Dropzone({ label, hint, accept, testId, preview, onFile }: { label: string; hint: string; accept: string; testId: string; preview?: string; onFile: (f: File) => void }) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [attached, setAttached] = useState<File | null>(null);

  const pick = (file: File) => {
    setAttached(file);
    onFile(file);
  };

  return (
    <div className="dropzone" tabIndex={0} role="button" aria-label={t("Upload {label}", { label: t(label) })} onClick={() => inputRef.current?.click()} onKeyDown={e => { if (e.key === "Enter") inputRef.current?.click(); }}>
      <input ref={inputRef} type="file" accept={accept} data-testid={testId} style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) pick(e.target.files[0]); }} />
      {preview && <img className="dz-art" src={preview} alt="" />}
      {attached
        ? <><b>{t("Attached ✓")}</b>{attached.name} · {(attached.size / 1024).toFixed(0)} KB</>
        : <><b>{t(label)}</b>{t(hint)}</>}
    </div>
  );
}

export default function SongForm({ initial, initialNote, proposalType, error, submitLabel, submitHint, busy, busyLabel, progress, onChange, onSubmit }: {
  initial: SongFormValues;
  /** the note a reopened draft already carries */
  initialNote?: string;
  /** set on the edit page: the form proposes a change to a published song instead of a new package */
  proposalType?: ProposalType;
  error?: string;
  submitLabel: string;
  submitHint: string;
  busy?: boolean;
  busyLabel?: string;
  progress?: string;
  onChange?: (form: SongFormValues) => void;
  onSubmit: (form: SongFormValues, files: SongFiles, note: string) => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState<SongFormValues>(initial);
  const [files, setFiles] = useState<SongFiles>({});
  const [note, setNote] = useState(initialNote || "");
  const [missing, setMissing] = useState<string[]>([]);
  const [similar, setSimilar] = useState<SimilarSong[]>([]);
  const [catalog, setCatalog] = useState<Song[]>([]);
  const [parentQuery, setParentQuery] = useState("");
  const [artPreview, setArtPreview] = useState("");
  const lock = useRef(false);
  // an edit is already aimed at one song — only a brand new submission can duplicate the library
  const isNewSong = !proposalType;
  // which steps a proposal type shows: a correction is the whole form, files add nothing but files, a removal is only the note
  const showSong = !proposalType || proposalType === "correction";
  const showFiles = proposalType !== "removal";
  const showLicense = showSong;
  const showWord = proposalType !== "removal";
  // encoding the cover art is async — submit waits on it so a fast click can't drop the file
  const artJob = useRef<Promise<SongFiles> | null>(null);

  const set = (field: string, value: string | boolean) => setForm(f => ({ ...f, [field]: value }));

  useEffect(() => { onChange?.(form); }, [form]);
  useEffect(() => () => { if (artPreview) URL.revokeObjectURL(artPreview); }, [artPreview]);
  useEffect(() => { if (!busy) lock.current = false; }, [busy]);
  // the parent picker searches the published catalog — only fetched once a relation is claimed
  useEffect(() => { if (isNewSong && form.submissionType !== "new" && !catalog.length) loadSongs().then(setCatalog).catch(() => { }); }, [isNewSong, form.submissionType]);

  useEffect(() => {
    if (!isNewSong) return;
    const title = form.title.trim();
    const firstLine = firstLyricLine(form.chordPro);
    if (title.length < 3 && !firstLine) { setSimilar([]); return; }
    let live = true;
    const timer = setTimeout(() => {
      const query = new URLSearchParams({ title, writer: form.writer.trim(), firstLine });
      wcGet(`/songs/similar?${query}`).then(rows => { if (live) setSimilar(rows || []); }).catch(() => { if (live) setSimilar([]); });
    }, 500);
    return () => { live = false; clearTimeout(timer); };
  }, [isNewSong, form.title, form.writer, form.chordPro]);

  const selectedThemes = parseThemes(form.themes);
  const themeChips = [...new Set([...THEMES, ...selectedThemes])];
  const knownKeys = new Set([...MAJOR_KEYS, ...MINOR_KEYS]);
  const proWarn = /GEMA|PRS|publisher|licensing admin/i.test(form.proAnswer);
  const lint = useMemo(() => lintChordPro(form.chordPro, form.songKey), [form.chordPro, form.songKey]);
  const noteLength = note.trim().length;
  const noteShort = !!proposalType && noteLength < MIN_NOTE_LENGTH;

  const parentSong = catalog.find(s => s.id === form.parentSongId) || null;
  const query = parentQuery.trim().toLowerCase();
  const parentChoices = catalog.filter(s => !query || s.title.toLowerCase().includes(query)).slice(0, 50);
  if (parentSong && !parentChoices.some(s => s.id === parentSong.id)) parentChoices.unshift(parentSong);

  const setType = (submissionType: SubmissionType) => setForm(f => ({ ...f, submissionType, parentSongId: submissionType === "new" ? "" : f.parentSongId }));
  // an arrangement keeps the original's title, credit and key unless the writer changes them
  const pickParent = (id: string) => {
    const picked = catalog.find(s => s.id === id);
    setForm(f => ({ ...f, parentSongId: id, ...(picked && f.submissionType === "arrangement" ? { title: picked.title, writer: picked.writer || "", songKey: picked.songKey || f.songKey } : {}) }));
  };

  const setThemes = (list: string[]) => set("themes", [...new Set(list)].join(", "));
  const toggleTheme = (th: string) => {
    setThemes(selectedThemes.includes(th) ? selectedThemes.filter(x => x !== th) : [...selectedThemes, th]);
  };

  // the messages mirror the API's SubmitValidation so a slip past this list reads the same when the server repeats it
  const validate = () => {
    const gaps: string[] = [];
    if (showSong) {
      if (!form.title.trim()) gaps.push(t("Title"));
      if (!form.writer.trim()) gaps.push(t("Writer(s)"));
      if (!form.chordPro.trim()) gaps.push(t("Lyrics and chords"));
      else if (lint.some(i => i.level === "error")) gaps.push(t("Lyrics and chords — fix the errors listed under the preview"));
    }
    // the society question is the writer's to answer; a change to a live song inherits whatever the song already carries
    if (isNewSong && !form.proAnswer) gaps.push(t("Collecting societies & licensing admins"));
    if (showWord && !form.certified) gaps.push(t("Your word"));
    if (files.demoAudio && !form.recordingOwned) gaps.push(t("This recording is mine (or I have the owner’s permission to share it)."));
    if (proposalType && noteShort) gaps.push(proposalType === "removal" ? t("A note of at least {n} characters is required: say why the song should come down", { n: MIN_NOTE_LENGTH }) : t("A note of at least {n} characters is required: say what changed and why", { n: MIN_NOTE_LENGTH }));
    if (proposalType === "additionalFile" && !Object.values(files).some(Boolean)) gaps.push(t("Add at least one file."));
    if (isNewSong && form.submissionType !== "new" && !form.parentSongId) gaps.push(t("The original song"));
    if (isNewSong && form.submissionType === "translation" && !form.translator.trim()) gaps.push(t("Translator is required for a translation"));
    if (isNewSong && form.submissionType === "arrangement" && !form.arranger.trim()) gaps.push(t("Arranger is required for an arrangement"));
    if (isNewSong && form.submissionType === "translation" && parentSong && parentSong.language === form.language) gaps.push(t("A translation must be in a different language from the original ({language})", { language: t(parentSong.language) }));
    return gaps;
  };

  let stepNumber = 0;
  const step = () => ++stepNumber;

  return (
    <form noValidate onSubmit={e => {
      e.preventDefault();
      if (busy || lock.current) return;
      const gaps = validate();
      setMissing(gaps);
      if (gaps.length) return;
      lock.current = true;
      const go = (extra: SongFiles) => onSubmit(form, { ...files, ...extra }, note);
      if (artJob.current) artJob.current.then(go, () => go({}));
      else go({});
    }}>
      {showSong && (
        <section className="step">
          <h2><span className="n">{step()}</span>{t("The song")}</h2>
          <p className="hint">{t("What a worship leader needs to find it and decide if it fits Sunday.")}</p>
          <div className="step-body">
            {isNewSong && (
              <div className="field">
                <label>{t("What are you adding?")}</label>
                <div className="sub-type" data-testid="submission-type">
                  {([["new", "New song"], ["translation", "Translation of an existing hymn"], ["arrangement", "Arrangement of an existing song"]] as [SubmissionType, string][]).map(([value, label]) => (
                    <label key={value}>
                      <input type="radio" name="submission-type" value={value} checked={form.submissionType === value} onChange={() => setType(value)} />
                      {t(label)}
                    </label>
                  ))}
                </div>
              </div>
            )}
            {isNewSong && form.submissionType !== "new" && (
              <div className="field">
                <label htmlFor="parent-song">{t("The original song")}</label>
                <input type="search" id="parent-search" data-testid="parent-search" placeholder={t("Search the library by title")} value={parentQuery} onChange={e => setParentQuery(e.target.value)} />
                <select id="parent-song" data-testid="parent-song" value={form.parentSongId} onChange={e => pickParent(e.target.value)} style={{ marginTop: 8 }}>
                  <option value="">{catalog.length ? t("Choose the original…") : t("Loading…")}</option>
                  {parentChoices.map(s => <option key={s.id} value={s.id}>{`${s.title} — ${s.writer || "?"} (${s.language})`}</option>)}
                </select>
                <p className="hint">{t("We link the two song pages together, both ways.")}</p>
              </div>
            )}
            {isNewSong && form.submissionType === "translation" && (
              <div className="field">
                <label htmlFor="translator">{t("Translator — as it should appear publicly")}</label>
                <input type="text" id="translator" data-testid="translator" required maxLength={120} placeholder={t("Who wrote these words in this language")} value={form.translator} onChange={e => set("translator", e.target.value)} />
              </div>
            )}
            {isNewSong && form.submissionType === "arrangement" && (
              <div className="field">
                <label htmlFor="arranger">{t("Arranger — as it should appear publicly")}</label>
                <input type="text" id="arranger" data-testid="arranger" required maxLength={120} placeholder={t("Who made this arrangement")} value={form.arranger} onChange={e => set("arranger", e.target.value)} />
              </div>
            )}
            <div className="field">
              <label htmlFor="title">{t("Title")}</label>
              <input type="text" id="title" required value={form.title} onChange={e => set("title", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="writers">{t("Writer(s) — as it should appear publicly")}</label>
              <input type="text" id="writers" placeholder={t("Every co-writer, exactly as it should appear on chord charts")} required value={form.writer} onChange={e => set("writer", e.target.value)} />
            </div>
            {similar.length > 0 && (
              <div className="dup-warning" data-testid="duplicate-warning">
                <b>{t("This looks like {title} by {writer}, already in the library", { title: similar[0].title, writer: similar[0].writer })}</b>
                <ul>
                  {similar.map(s => (
                    <li key={s.id}><Link to={`/songs/${s.id}`}>{s.writer ? t("{title} — {writer}", { title: s.title, writer: s.writer }) : s.title}</Link></li>
                  ))}
                </ul>
                <p>{t("If it is the same song, propose an edit there instead.")}</p>
              </div>
            )}
            <div className="field-row field">
              <div>
                <label htmlFor="year">{t("Year written")}</label>
                <input type="number" id="year" min={1000} max={new Date().getFullYear()} placeholder={t("e.g. 2025")} value={form.year} onChange={e => set("year", e.target.value)} />
              </div>
              <div>
                <label htmlFor="key">{t("Original key")}</label>
                <select id="key" value={form.songKey} onChange={e => set("songKey", e.target.value)}>
                  <optgroup label={t("Major")}>
                    {MAJOR_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                  </optgroup>
                  <optgroup label={t("Minor")}>
                    {MINOR_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                  </optgroup>
                  {!knownKeys.has(form.songKey) && form.songKey && <option value={form.songKey}>{form.songKey}</option>}
                </select>
              </div>
              <div>
                <label htmlFor="bpm">{t("Tempo (BPM)")}</label>
                <input type="number" id="bpm" min={30} max={220} placeholder={t("e.g. 72")} value={form.bpm} onChange={e => set("bpm", e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label id="themes-label">{t("Themes")}</label>
              <div className="theme-chips" data-testid="theme-chips" role="group" aria-labelledby="themes-label">
                {themeChips.map(th => (
                  <button key={th} type="button" className={"chip" + (selectedThemes.includes(th) ? " on" : "")} aria-pressed={selectedThemes.includes(th)} onClick={() => toggleTheme(th)}>{th}</button>
                ))}
              </div>
            </div>
            <div className="field-row field">
              <div>
                <label htmlFor="lang">{t("Language")}</label>
                <select id="lang" value={form.language} onChange={e => set("language", e.target.value)}>
                  {(SONG_LANGS.includes(form.language) ? SONG_LANGS : [...SONG_LANGS, form.language]).filter(Boolean).map(l => (
                    <option key={l} value={l}>{t(l)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="scripture">{t("Scripture reference")}</label>
                <input type="text" id="scripture" placeholder="Isaiah 40:4" value={form.scripture} onChange={e => set("scripture", e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="lyrics">{t("Lyrics and chords")}</label>
              <textarea id="lyrics" rows={9} placeholder={t("ChordPro welcome — [D]Every valley [G]shall be [D]lifted…")} required value={form.chordPro} onChange={e => set("chordPro", e.target.value)} />
              <p className="hint">{t("Start each section with its name (Verse 1, Chorus…), chords in [brackets]. We generate the chord chart and downloads from this.")}</p>
            </div>
            {form.chordPro.trim() !== "" && (
              <div className="field">
                <label>{t("Chart preview — how churches will see it")}</label>
                <div className="cp-preview-box"><ChordProPreview chordPro={form.chordPro} /></div>
                {lint.length > 0 && (
                  <ul className="cp-lint" data-testid="chordpro-lint">
                    {lint.map((issue, i) => (
                      <li key={i} className={issue.level}>{t("Line {line}", { line: issue.line })} — {t(issue.message, issue.vars)}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {showFiles && (
        <section className="step">
          <h2><span className="n">{step()}</span>{t("Files")}</h2>
          <p className="hint">{proposalType === "additionalFile"
            ? t("Add what the song is missing — a score, a recording, stems, art, or the lyrics as a text file. Nothing else about the song changes.")
            : t("Optional — but a demo recording is the single best thing you can give a worship leader deciding at 10pm on a Thursday.")}</p>
          <div className="step-body dz-row">
            {proposalType === "additionalFile" && (
              <>
                <Dropzone label="Score" hint="MusicXML, MuseScore or LilyPond · .musicxml .xml .mxl .mscz .ly" accept=".musicxml,.xml,.mxl,.mscz,.ly" testId="file-score" onFile={f => setFiles(x => ({ ...x, score: f }))} />
                <Dropzone label="Score scan" hint="A PDF or image of the printed score · .pdf .png .jpg .tif" accept=".pdf,.png,.jpg,.jpeg,.tif" testId="file-score-image" onFile={f => setFiles(x => ({ ...x, scoreImage: f }))} />
              </>
            )}
            <Dropzone label="Demo recording" hint="Drop an MP3 or WAV, or click to choose · a phone recording is fine" accept="audio/*,.mp3,.wav" testId="file-demo" onFile={f => setFiles(x => ({ ...x, demoAudio: f }))} />
            {proposalType !== "additionalFile" && (
              <Dropzone label="Sheet music" hint="Lead sheet or vocal score · PDF or MusicXML" accept=".pdf,.xml,.musicxml" testId="file-sheet" onFile={f => setFiles(x => ({ ...x, sheetPdf: f }))} />
            )}
            <Dropzone label="MIDI melody" hint="A .mid file of the tune · churches play it in the browser" accept=".mid,.midi,audio/midi" testId="file-midi" onFile={f => setFiles(x => ({ ...x, midi: f }))} />
            <Dropzone label="Multitracks" hint="ZIP of stems — one WAV or MP3 per part, every file starting at bar 1 · include click & guide if you have them" accept=".zip" testId="file-stems" onFile={f => setFiles(x => ({ ...x, stemsZip: f }))} />
            <Dropzone label="Cover art" hint="JPG, PNG or WebP · we shrink it and make the thumbnail here in your browser" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" testId="file-art" preview={artPreview} onFile={f => {
              const job: Promise<SongFiles> = prepareArt(f).catch(() => ({ art: f }));
              artJob.current = job;
              job.then(art => {
                setFiles(x => ({ ...x, ...art }));
                setArtPreview(URL.createObjectURL((art.thumb || art.art) as File));
              });
            }} />
            {proposalType === "additionalFile" && (
              <Dropzone label="Lyrics or ChordPro file" hint="Plain text or ChordPro · .cho .crd .txt" accept=".cho,.crd,.txt,.chordpro,text/plain" testId="file-lyrics" onFile={f => setFiles(x => ({ ...x, lyrics: f }))} />
            )}
          </div>
          <p className="hint" style={{ margin: "10px 0 0 52px" }}>{t("Files up to ~35 MB each. Upload stems once, in the recorded key.")}</p>
          {files.demoAudio && (
            <div className="certify" style={{ margin: "16px 0 0 52px" }}>
              <input type="checkbox" id="recording-owned" data-testid="recording-owned" required checked={form.recordingOwned} onChange={e => set("recordingOwned", e.target.checked)} />
              <label htmlFor="recording-owned" style={{ fontWeight: 400, fontSize: "0.9375rem", margin: 0, cursor: "pointer" }}>
                {t("This recording is mine (or I have the owner’s permission to share it).")}
              </label>
            </div>
          )}
        </section>
      )}

      {showLicense && (
        <section className="step">
          <h2><span className="n">{step()}</span>{t("What you’re giving")}</h2>
          <p className="hint">{t("Every option makes the song free for worship forever. They differ in what you keep.")}</p>
          {/* radio values are the registry ids in licenses.json; only uploadable licenses are offered (SA and NC are harvest-only) */}
          <div className="step-body" data-testid="license-choice">
            <label className="choice">
              <input type="radio" name="license" value="WC" checked={form.license === "WC"} onChange={() => set("license", "WC")} />
              <span>
                <strong>{t("Free for worship")}</strong> <span className="free-badge">{t("Recommended")}</span>
                <LicenseRecap
                  churches={[t("Sing it free, forever"), t("Project, print, stream worship"), t("Transpose, arrange, translate")]}
                  keep={[t("Recordings & sheet-music sales"), t("Sync, concerts, radio"), t("Ownership of the song")]}
                />
                <p><Link to="/license">{t("Read the license.")}</Link></p>
              </span>
            </label>
            <label className="choice">
              <input type="radio" name="license" value="CC-BY" checked={form.license === "CC-BY"} onChange={() => set("license", "CC-BY")} />
              <span>
                <strong>{t("CC BY 4.0")}</strong> <span className="cc-badge">{t("Credit required")}</span>
                <LicenseRecap
                  churches={[t("Every use, worship and commercial, if they credit you"), t("Same rules as the wider Creative Commons world")]}
                  keep={[t("Copyright and the right to be credited"), t("Not exclusivity — anyone may sell recordings or sheet music with credit")]}
                />
                <p><a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="license noopener">{t("Read the license.")}</a></p>
              </span>
            </label>
            <label className="choice">
              <input type="radio" name="license" value="PD" checked={form.license === "PD"} onChange={() => set("license", "PD")} />
              <span>
                <strong>{t("Public domain")}</strong> <span className="pd-badge">{t("Everything, everyone")}</span>
                <LicenseRecap
                  churches={[t("Every use — worship and commercial"), t("Same commons as the hymns")]}
                  keep={[t("Nothing"), t("CC0 dedication, permanent, everywhere")]}
                />
              </span>
            </label>
          </div>
        </section>
      )}

      {showWord && (
        <section className="step">
          <h2><span className="n">{step()}</span>{t("Your word")}</h2>
          <div className="step-body">
            {isNewSong && (
              <div className="field">
                <label htmlFor="pro">{t("Collecting societies & licensing admins")}</label>
                <select id="pro" required value={form.proAnswer} onChange={e => set("proAnswer", e.target.value)}>
                  <option value="">{t("Are you a member of one?…")}</option>
                  {/* value stays English so submissions read the same for reviewers */}
                  {["No — nobody else administers my songs", "Yes — ASCAP, BMI, or SESAC", "Yes — GEMA, PRS, or another society outside the U.S.", "Yes — a publisher or licensing admin administers this song"]
                    .map(o => <option key={o} value={o}>{t(o)}</option>)}
                </select>
                {proWarn && (
                  <p className="pro-warning" data-testid="pro-warning">{t("Check your membership terms — this grant may not be yours to make.")}</p>
                )}
                <p className="hint">{t("U.S.-style societies leave you free to give your own song away. Many societies elsewhere (GEMA and others) take over your performance rights when you join — if that’s you, check your membership terms before sharing, or this grant may not be yours to make.")}</p>
              </div>
            )}
            <div className="certify">
              <input type="checkbox" id="certify" required checked={form.certified} onChange={e => set("certified", e.target.checked)} />
              <label htmlFor="certify" style={{ fontWeight: 400, fontSize: "0.9375rem", margin: 0, cursor: "pointer" }}>
                <em>{t("I wrote this song or control its copyright — words, music, and every file I’m uploading — and every co-writer, publisher, and recording owner is on board. No society, publisher, or admin has taken away my right to make this grant. I release the song under the license I chose, permanently. I let WorshipCommons host, convert, transpose, show my name, and deliver these files, including to the tools churches use. I can ask you to stop hosting; copies already out keep the license. If I was wrong, that’s on me — not the churches that trusted it, and not WorshipCommons.")}</em>
                <span className="hint" style={{ display: "block", marginTop: 8 }}>{t("This grant is the recap above — the license you chose.")}</span>
                {form.license === "CC-BY" && <span className="hint" style={{ display: "block", marginTop: 6 }} data-testid="cc-by-hint">{t("CC BY grants commercial use to everyone, not only churches: anyone may sell recordings or sheet music of this song as long as they credit you.")}</span>}
                <span className="hint" style={{ display: "block", marginTop: 8 }}>{t("This promise is the whole trust model of the commons. If a song gets shared by someone who doesn’t own it, the")} <Link to="/report">{t("reporting process")}</Link> {t("makes it right.")}</span>
              </label>
            </div>
          </div>
        </section>
      )}

      {proposalType && (
        <section className="step">
          <h2><span className="n">{step()}</span>{t(NOTE_HEADING[proposalType])}</h2>
          <div className="step-body">
            {proposalType === "removal" && (
              <div className="removal-warning" data-testid="removal-warning">
                <b>{t("This asks a reviewer to take the song down.")}</b>
                <p>{t("Nothing changes until a reviewer agrees. If they do, the song leaves the library and its page; churches that already downloaded it keep the license they received. Say who you are and why it should come down — a rights problem, a mistake, or your own wish as the writer.")}</p>
              </div>
            )}
            <div className="field">
              <label htmlFor="edit-note">{proposalType === "removal" ? t("Why should this song come down?") : t("Your note to the reviewer")}</label>
              <textarea id="edit-note" data-testid="edit-note" rows={proposalType === "correction" ? 3 : 4} required value={note} onChange={e => setNote(e.target.value)} />
              <p className={"hint note-count" + (noteShort ? " short" : "")} data-testid="note-count">
                {noteShort ? t("{n} of {min} characters — a few more words, please", { n: noteLength, min: MIN_NOTE_LENGTH }) : t("{n} characters", { n: noteLength })}
              </p>
            </div>
          </div>
        </section>
      )}

      {(missing.length > 0 || error) && (
        <div className="hint upload-missing" style={{ color: "var(--secondary)", fontWeight: 600 }} data-testid="upload-error">
          {missing.length > 0 && (
            <ul>{missing.map(item => <li key={item}>{item}</li>)}</ul>
          )}
          {error && <p style={{ margin: missing.length ? "8px 0 0" : 0 }}>{error}</p>}
        </div>
      )}
      <div className="submit-row">
        <button type="submit" className="btn btn-primary" disabled={!!busy || noteShort} data-testid="submit-song">{busy ? t(busyLabel || "Please wait…") : t(submitLabel)}</button>
        <p className="hint" data-testid={progress ? "upload-progress" : undefined}>{progress || t(submitHint)}</p>
      </div>
    </form>
  );
}
