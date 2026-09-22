import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChordProPreview } from "./ChordProPreview";
import { wcGet } from "../api";
import { parseChordPro, lintChordPro } from "../chordpro";
import { licenseById, UPLOADABLE } from "../licenses";
import { prepareArt } from "../artThumb";
import "../styles/upload.css";
import { useI18n, SONG_LANG } from "../i18n";
import { THEMES, loadSongs, Song, songPath } from "../songs";

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
/** The proposal types that change a published song (the edit page); recording adds a master under its own license. */
export type ProposalType = "correction" | "additionalFile" | "recording" | "removal";
export const PROPOSAL_TYPES: ProposalType[] = ["correction", "additionalFile", "recording", "removal"];
/** What a new submission gives: the composition alone is a complete song; a master recording is a second grant with its own license. */
export type Scope = "composition" | "both";
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
  ccli: string;
  chordPro: string;
  license: string;
  scope: Scope;
  masterLicense: string;
  proAnswer: string;
  certifyAdult: boolean;
  certifyWrote: boolean;
  certifyCowriters: boolean;
  certifyClear: boolean;
  certifyForever: boolean;
  certifyHuman: boolean;
  recordingOwned: boolean;
}

export const GRANT_KEYS = ["certifyAdult", "certifyWrote", "certifyCowriters", "certifyClear", "certifyForever", "certifyHuman"] as const;
export type GrantKey = typeof GRANT_KEYS[number];
export const grantComplete = (f: Pick<SongFormValues, GrantKey>) => GRANT_KEYS.every(k => f[k]);
const blankGrant = (): Pick<SongFormValues, GrantKey> => ({ certifyAdult: false, certifyWrote: false, certifyCowriters: false, certifyClear: false, certifyForever: false, certifyHuman: false });

export type SongFiles = { demoAudio?: File; master?: File; sheetPdf?: File; stemsZip?: File; midi?: File; art?: File; thumb?: File; score?: File; scoreImage?: File; lyrics?: File };

/** Either audio file is a recording someone must vouch for. */
export const hasRecording = (files: SongFiles) => !!(files.demoAudio || files.master);

/** Progress-line names for every upload role, keyed by SongFiles key. */
export const FILE_LABEL: Record<string, string> = { demoAudio: "demo recording", master: "master recording", sheetPdf: "sheet music", stemsZip: "multitracks", midi: "MIDI melody", art: "cover art", thumb: "cover art", score: "score", scoreImage: "score scan", lyrics: "lyrics file" };

export const blankSong = (language: string): SongFormValues => ({ submissionType: "new", parentSongId: "", translator: "", arranger: "", title: "", writer: "", year: "", songKey: "D", bpm: "", themes: "", language, scripture: "", ccli: "", chordPro: "", license: "WC", scope: "composition", masterLicense: "WC", proAnswer: "", ...blankGrant(), recordingOwned: false });

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
    ccli: d.ccli ? String(d.ccli) : "",
    chordPro: d.chordPro || "",
    license: UPLOADABLE.some(l => l.id === payload?.license) ? payload.license : "WC",
    scope: d.masterLicense ? "both" : "composition",
    masterLicense: UPLOADABLE.some(l => l.id === d.masterLicense) ? d.masterLicense : "WC",
    proAnswer: d.proAnswer || "",
    certifyAdult: !!d.certifyAdult,
    certifyWrote: !!d.certifyWrote,
    certifyCowriters: !!d.certifyCowriters,
    certifyClear: !!d.certifyClear,
    certifyForever: !!d.certifyForever,
    certifyHuman: !!d.certifyHuman,
    recordingOwned: false
  };
};

// free text the song page shows under the related song; "" when this is a standalone song
export const relationLabelFor = (form: SongFormValues) =>
  !form.parentSongId ? "" : form.submissionType === "translation" ? `Translation (${form.language})` : form.submissionType === "arrangement" ? "Arrangement" : "";

// base keeps the fields this form doesn't edit (scriptureText, videoUrl…) when proposing an edit
export const payloadFrom = (form: SongFormValues, hasAudio: boolean, base?: any) => ({
  ...base,
  type: form.submissionType,
  name: form.title,
  tags: form.themes,
  language: form.language,
  license: form.license,
  licenseVersion: licenseById(form.license).versionDefault, // WC 1.0 · CC BY 4.0 · PD is a CC0 dedication
  attestationVersion: "1.2", // 1.2 split the grant into adult / authorship / co-writers / unencumbered / forever / human
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
    ccli: form.ccli.trim() || undefined,
    chordPro: form.chordPro,
    proAnswer: form.proAnswer,
    // the master's own grant; a composition-only submission carries whatever the live song already has
    masterLicense: form.scope === "both" ? form.masterLicense : base?.detail?.masterLicense,
    certified: grantComplete(form),
    certifyAdult: form.certifyAdult,
    certifyWrote: form.certifyWrote,
    certifyCowriters: form.certifyCowriters,
    certifyClear: form.certifyClear,
    certifyForever: form.certifyForever,
    certifyHuman: form.certifyHuman,
    recordingOwned: hasAudio ? form.recordingOwned : base?.detail?.recordingOwned
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
  recording: "About this recording",
  removal: "Why should this song come down?"
};

interface LicenseRecapProps {
  churches: string[];
  keep: string[];
}

const LicenseRecap: React.FC<LicenseRecapProps> = (props) => {
  const { t } = useI18n();
  return (
    <div className="license-recap">
      <div>
        <b>{t("Churches get:")}</b>
        <ul>{props.churches.map(item => <li key={item}>{item}</li>)}</ul>
      </div>
      <div>
        <b>{t("You keep:")}</b>
        <ul>{props.keep.map(item => <li key={item}>{item}</li>)}</ul>
      </div>
    </div>
  );
};

interface LicenseRadiosProps {
  name: string;
  value: string;
  onChange: (id: string) => void;
  testId: string;
}

/** The three uploadable licenses as radios; the same set serves the composition and the master, under different names. */
const LicenseRadios: React.FC<LicenseRadiosProps> = (props) => {
  const { t } = useI18n();
  return (
    <div className="step-body" data-testid={props.testId}>
      <label className="choice">
        <input type="radio" name={props.name} value="WC" checked={props.value === "WC"} onChange={() => props.onChange("WC")} />
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
        <input type="radio" name={props.name} value="CC-BY" checked={props.value === "CC-BY"} onChange={() => props.onChange("CC-BY")} />
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
        <input type="radio" name={props.name} value="PD" checked={props.value === "PD"} onChange={() => props.onChange("PD")} />
        <span>
          <strong>{t("Public domain")}</strong> <span className="pd-badge">{t("Everything, everyone")}</span>
          <LicenseRecap
            churches={[t("Every use — worship and commercial"), t("Same commons as the hymns")]}
            keep={[t("Nothing"), t("CC0 dedication, permanent, everywhere")]}
          />
        </span>
      </label>
    </div>
  );
};

interface RecordingOwnedProps {
  checked: boolean;
  onChange: (v: boolean) => void;
}

const RecordingOwned: React.FC<RecordingOwnedProps> = (props) => {
  const { t } = useI18n();
  return (
    <div className="certify" style={{ margin: "16px 0 0" }}>
      <input type="checkbox" id="recording-owned" data-testid="recording-owned" required checked={props.checked} onChange={e => props.onChange(e.target.checked)} />
      <label htmlFor="recording-owned" style={{ fontWeight: 400, fontSize: "0.9375rem", margin: 0, cursor: "pointer" }}>
        {t("This recording is mine (or I have the owner’s permission to share it).")}
      </label>
    </div>
  );
};

interface DropzoneProps {
  label: string;
  hint: string;
  accept: string;
  testId: string;
  preview?: string;
  onFile: (f: File) => void;
}

const Dropzone: React.FC<DropzoneProps> = (props) => {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [attached, setAttached] = useState<File | null>(null);

  const pick = (file: File) => {
    setAttached(file);
    props.onFile(file);
  };

  return (
    <div className="dropzone" tabIndex={0} role="button" aria-label={t("Upload {label}", { label: t(props.label) })} onClick={() => inputRef.current?.click()} onKeyDown={e => { if (e.key === "Enter") inputRef.current?.click(); }}>
      <input ref={inputRef} type="file" accept={props.accept} data-testid={props.testId} style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) pick(e.target.files[0]); }} />
      {props.preview && <img className="dz-art" src={props.preview} alt="" />}
      {attached
        ? <><b>{t("Attached ✓")}</b>{attached.name} · {(attached.size / 1024).toFixed(0)} KB</>
        : <><b>{t(props.label)}</b>{t(props.hint)}</>}
    </div>
  );
};

interface Props {
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
}

export const SongForm: React.FC<Props> = (props) => {
  const { t } = useI18n();
  const [form, setForm] = useState<SongFormValues>(props.initial);
  const [files, setFiles] = useState<SongFiles>({});
  const [note, setNote] = useState(props.initialNote || "");
  const [missing, setMissing] = useState<string[]>([]);
  const [similar, setSimilar] = useState<SimilarSong[]>([]);
  const [catalog, setCatalog] = useState<Song[]>([]);
  const [parentQuery, setParentQuery] = useState("");
  const [artPreview, setArtPreview] = useState("");
  const lock = useRef(false);
  // an edit is already aimed at one song — only a brand new submission can duplicate the library
  const isNewSong = !props.proposalType;
  // which steps a proposal type shows: a correction is the whole form, files add nothing but files, a removal is only the note
  const showSong = !props.proposalType || props.proposalType === "correction";
  const showFiles = props.proposalType !== "removal" && props.proposalType !== "recording";
  const showLicense = showSong;
  // the master recording block: on a new song once "both" is chosen, and the whole of a recording proposal
  const showMaster = isNewSong ? form.scope === "both" : props.proposalType === "recording";
  const showWord = props.proposalType !== "removal";
  // encoding the cover art is async — submit waits on it so a fast click can't drop the file
  const artJob = useRef<Promise<SongFiles> | null>(null);

  const set = (field: string, value: string | boolean) => setForm(f => ({ ...f, [field]: value }));

  useEffect(() => { props.onChange?.(form); }, [form]);
  useEffect(() => () => { if (artPreview) URL.revokeObjectURL(artPreview); }, [artPreview]);
  useEffect(() => { if (!props.busy) lock.current = false; }, [props.busy]);
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
  const lint = useMemo(() => lintChordPro(form.chordPro, form.songKey), [form.chordPro, form.songKey]);
  const noteLength = note.trim().length;
  const noteShort = !!props.proposalType && noteLength < MIN_NOTE_LENGTH;

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
      if (form.ccli.trim() && !/^\d{4,8}$/.test(form.ccli.trim())) gaps.push(t("CCLI number must be 4–8 digits"));
      if (!form.chordPro.trim()) gaps.push(t("Lyrics and chords"));
      else if (lint.some(i => i.level === "error")) gaps.push(t("Lyrics and chords — fix the errors listed under the preview"));
    }
    if (showWord && !grantComplete(form)) gaps.push(t("Your word — every box in this step"));
    if (showMaster && !files.master) gaps.push(t("Master recording"));
    if (hasRecording(files) && !form.recordingOwned) gaps.push(t("This recording is mine (or I have the owner’s permission to share it)."));
    if (props.proposalType && noteShort) gaps.push(props.proposalType === "removal" ? t("A note of at least {n} characters is required: say why the song should come down", { n: MIN_NOTE_LENGTH }) : t("A note of at least {n} characters is required: say what changed and why", { n: MIN_NOTE_LENGTH }));
    if (props.proposalType === "additionalFile" && !Object.values(files).some(Boolean)) gaps.push(t("Add at least one file."));
    if (isNewSong && form.submissionType !== "new" && !form.parentSongId) gaps.push(t("The original song"));
    if (isNewSong && form.submissionType === "translation" && !form.translator.trim()) gaps.push(t("Translator is required for a translation"));
    if (isNewSong && form.submissionType === "arrangement" && !form.arranger.trim()) gaps.push(t("Arranger is required for an arrangement"));
    if (isNewSong && form.submissionType === "translation" && parentSong && parentSong.language === form.language) gaps.push(t("A translation must be in a different language from the original ({language})", { language: t(parentSong.language) }));
    return gaps;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (props.busy || lock.current) return;
    const gaps = validate();
    setMissing(gaps);
    if (gaps.length) return;
    lock.current = true;
    const go = (extra: SongFiles) => props.onSubmit(form, { ...files, ...extra }, note);
    if (artJob.current) artJob.current.then(go, () => go({}));
    else go({});
  };

  let stepNumber = 0;
  const step = () => ++stepNumber;

  return (
    <form noValidate onSubmit={handleSubmit}>
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
                    <li key={s.id}><Link to={songPath(s)}>{s.writer ? t("{title} — {writer}", { title: s.title, writer: s.writer }) : s.title}</Link></li>
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
              <label htmlFor="ccli">{t("CCLI number (optional)")}</label>
              <input type="text" id="ccli" data-testid="ccli-number" inputMode="numeric" pattern="[0-9]{4,8}" maxLength={8} placeholder="22025" value={form.ccli} onChange={e => set("ccli", e.target.value.replace(/\D/g, "").slice(0, 8))} />
              <p className="hint">{t("If churches already report this song to CCLI, add the SongSelect number so nothing changes in their workflow. Reporting is optional for songs on this site.")}</p>
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
          <p className="hint">{props.proposalType === "additionalFile"
            ? t("Add what the song is missing — a score, a recording, stems, art, or the lyrics as a text file. Nothing else about the song changes.")
            : t("Optional — but a demo recording is the single best thing you can give a worship leader deciding at 10pm on a Thursday.")}</p>
          <div className="step-body dz-row">
            {props.proposalType === "additionalFile" && (
              <>
                <Dropzone label="Score" hint="MusicXML, MuseScore or LilyPond · .musicxml .xml .mxl .mscz .ly" accept=".musicxml,.xml,.mxl,.mscz,.ly" testId="file-score" onFile={f => setFiles(x => ({ ...x, score: f }))} />
                <Dropzone label="Score scan" hint="A PDF or image of the printed score · .pdf .png .jpg .tif" accept=".pdf,.png,.jpg,.jpeg,.tif" testId="file-score-image" onFile={f => setFiles(x => ({ ...x, scoreImage: f }))} />
              </>
            )}
            <Dropzone label="Demo recording" hint="Drop an MP3 or WAV, or click to choose · a phone recording is fine" accept="audio/*,.mp3,.wav" testId="file-demo" onFile={f => setFiles(x => ({ ...x, demoAudio: f }))} />
            {props.proposalType !== "additionalFile" && (
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
            {props.proposalType === "additionalFile" && (
              <Dropzone label="Lyrics or ChordPro file" hint="Plain text or ChordPro · .cho .crd .txt" accept=".cho,.crd,.txt,.chordpro,text/plain" testId="file-lyrics" onFile={f => setFiles(x => ({ ...x, lyrics: f }))} />
            )}
          </div>
          <p className="hint" style={{ margin: "10px 0 0" }}>{t("Files up to ~35 MB each. Upload stems once, in the recorded key.")}</p>
          {files.demoAudio && !showMaster && <RecordingOwned checked={form.recordingOwned} onChange={v => set("recordingOwned", v)} />}
        </section>
      )}

      {showLicense && (
        <section className="step">
          <h2><span className="n">{step()}</span>{t("What you’re giving")}</h2>
          {isNewSong && (
            <div className="field" style={{ margin: "0 0 16px" }}>
              <div className="sub-type" data-testid="scope-choice">
                {([["composition", "The composition — words, melody, chords and arrangement"], ["both", "The composition and a master recording"]] as [Scope, string][]).map(([value, label]) => (
                  <label key={value}>
                    <input type="radio" name="scope" value={value} checked={form.scope === value} onChange={() => set("scope", value)} />
                    {t(label)}
                  </label>
                ))}
              </div>
              <p className="hint">{t("A church needs the composition to sing the song, so that grant comes first. A master recording is a second grant and can carry its own license.")}</p>
            </div>
          )}
          <h3 style={{ margin: "0 0 4px" }}>{t("Composition license")}</h3>
          <p className="hint">{t("Every option makes the song free for worship forever. They differ in what you keep.")}</p>
          {/* radio values are the registry ids in licenses.json; only uploadable licenses are offered (SA and NC are harvest-only) */}
          <LicenseRadios name="license" value={form.license} onChange={id => set("license", id)} testId="license-choice" />
        </section>
      )}

      {showMaster && (
        <section className="step" data-testid="master-step">
          <h2><span className="n">{step()}</span>{t("Master recording")}</h2>
          <p className="hint">{t("The finished mix a band can play to. It unlocks stems and a full mix on the song page; the composition grant above stays as it is.")}</p>
          <div className="step-body dz-row">
            <Dropzone label="Master recording" hint="The finished mix · WAV, MP3, M4A or FLAC" accept="audio/*,.wav,.mp3,.m4a,.flac,.ogg" testId="file-master" onFile={f => setFiles(x => ({ ...x, master: f }))} />
          </div>
          <h3 style={{ margin: "16px 0 4px" }}>{t("Master recording license")}</h3>
          <p className="hint">{t("The recording can carry a different license from the composition.")}</p>
          <LicenseRadios name="masterLicense" value={form.masterLicense} onChange={id => set("masterLicense", id)} testId="master-license-choice" />
          <RecordingOwned checked={form.recordingOwned} onChange={v => set("recordingOwned", v)} />
        </section>
      )}

      {showWord && (
        <section className="step" data-testid="grant-step">
          <h2><span className="n">{step()}</span>{t("Your word")}</h2>
          <p className="hint">{t("This is the decision. Churches will not come back to check if you changed your mind.")}</p>
          <div className="step-body">
            <div className="grant-recap" data-testid="grant-recap">
              <p>{t("Churches may keep every copy even if you later ask us to take this song down. A publishing deal does not unwind worship use. You can only grant rights you actually hold. We host, convert, transpose, show your name, and deliver these files to the tools churches use. If you did not hold them, there was no grant. That is on you, not WorshipCommons.")}</p>
            </div>
            <div className="certify-list">
              {([
                ["certifyAdult", "I am 18 or older."],
                ["certifyWrote", "I wrote this song, or I control its copyright — words, music, and every file I’m uploading."],
                ["certifyCowriters", "Every co-writer has agreed in writing. If I am the only writer, there is no silent partner."],
                ["certifyClear", "No publisher, performing-rights society, or admin has taken away my right to make this grant."],
                ["certifyForever", "I understand worship use is forever. Asking you to stop hosting does not recall copies already out."],
                ["certifyHuman", "The words and melody were written by people, not generated by AI. A recording made with AI tools of a human-written song is fine."]
              ] as [GrantKey, string][]).map(([key, label]) => (
                <label key={key}>
                  <input type="checkbox" id={key} data-testid={key} required checked={form[key]} onChange={e => set(key, e.target.checked)} />
                  {t(label)}
                </label>
              ))}
            </div>
            <p className="hint" style={{ marginTop: 12 }}>{t("This grant is the recap above — the license you chose.")}</p>
            {(form.license === "CC-BY" || (showMaster && form.masterLicense === "CC-BY")) && <p className="hint" data-testid="cc-by-hint">{t("CC BY grants commercial use to everyone, not only churches: anyone may sell recordings or sheet music of this song as long as they credit you.")}</p>}
            <p className="hint">{t("If a song gets shared by someone who doesn’t own it, the")} <Link to="/report">{t("reporting process")}</Link> {t("is how we take it down.")}</p>
          </div>
        </section>
      )}

      {props.proposalType && (
        <section className="step">
          <h2><span className="n">{step()}</span>{t(NOTE_HEADING[props.proposalType])}</h2>
          <div className="step-body">
            {props.proposalType === "removal" && (
              <div className="removal-warning" data-testid="removal-warning">
                <b>{t("This asks a reviewer to take the song down.")}</b>
                <p>{t("Nothing changes until a reviewer agrees. If we take it down because you asked, churches that already have a copy keep the grant they received. If we take it down because it was never yours to share, there was no grant to keep. Say who you are and why it should come down — a rights problem, a mistake, or your own wish as the writer.")}</p>
              </div>
            )}
            <div className="field">
              <label htmlFor="edit-note">{props.proposalType === "removal" ? t("Why should this song come down?") : t("Your note to the reviewer")}</label>
              <textarea id="edit-note" data-testid="edit-note" rows={props.proposalType === "correction" ? 3 : 4} required value={note} onChange={e => setNote(e.target.value)} />
              <p className={"hint note-count" + (noteShort ? " short" : "")} data-testid="note-count">
                {noteShort ? t("{n} of {min} characters — a few more words, please", { n: noteLength, min: MIN_NOTE_LENGTH }) : t("{n} characters", { n: noteLength })}
              </p>
            </div>
          </div>
        </section>
      )}

      {(missing.length > 0 || props.error) && (
        <div className="hint upload-missing" style={{ color: "var(--secondary)", fontWeight: 600 }} data-testid="upload-error">
          {missing.length > 0 && (
            <ul>{missing.map(item => <li key={item}>{item}</li>)}</ul>
          )}
          {props.error && <p style={{ margin: missing.length ? "8px 0 0" : 0 }}>{props.error}</p>}
        </div>
      )}
      <div className="submit-row">
        <button type="submit" className="btn btn-primary" disabled={!!props.busy || noteShort} data-testid="submit-song">{props.busy ? t(props.busyLabel || "Please wait…") : t(props.submitLabel)}</button>
        <p className="hint" data-testid={props.progress ? "upload-progress" : undefined}>{props.progress || t(props.submitHint)}</p>
      </div>
    </form>
  );
};
