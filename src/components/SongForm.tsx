import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import ChordProPreview from "./ChordProPreview";
import "../styles/upload.css";
import { useI18n, SONG_LANG } from "../i18n";

const SONG_LANGS = Object.values(SONG_LANG);

export interface SongFormValues {
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

export type SongFiles = { demoAudio?: File; sheetPdf?: File; stemsZip?: File };

export const blankSong = (language: string): SongFormValues => ({ title: "", writer: "", year: "", songKey: "D", bpm: "", themes: "", language, scripture: "", chordPro: "", license: "wc", proAnswer: "", certified: false, recordingOwned: false });

export const songFromPayload = (payload: any): SongFormValues => {
  const d = payload?.detail || {};
  return {
    title: payload?.name || "",
    writer: d.writer || "",
    year: d.year ? String(d.year) : "",
    songKey: d.songKey || "D",
    bpm: d.bpm ? String(d.bpm) : "",
    themes: payload?.tags || "",
    language: payload?.language || "English",
    scripture: d.scripture || "",
    chordPro: d.chordPro || "",
    license: payload?.license === "PD" ? "pd" : "wc",
    proAnswer: d.proAnswer || "",
    certified: true,
    recordingOwned: false
  };
};

// base keeps the fields this form doesn't edit (scriptureText, videoUrl…) when proposing an edit
export const payloadFrom = (form: SongFormValues, hasDemo: boolean, base?: any) => ({
  ...base,
  name: form.title,
  tags: form.themes,
  language: form.language,
  license: form.license === "pd" ? "PD" : "WC",
  detail: {
    ...base?.detail,
    writer: form.writer,
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

export const conventionalName = (role: string, file: File) => `${role}.${(file.name.split(".").pop() || "").toLowerCase()}`;

function Dropzone({ label, hint, accept, testId, onFile }: { label: string; hint: string; accept: string; testId: string; onFile: (f: File) => void }) {
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
      {attached
        ? <><b>{t("Attached ✓")}</b>{attached.name} · {(attached.size / 1024).toFixed(0)} KB</>
        : <><b>{t(label)}</b>{t(hint)}</>}
    </div>
  );
}

export default function SongForm({ initial, noteLabel, error, submitLabel, submitHint, onSubmit }: {
  initial: SongFormValues;
  noteLabel?: string;
  error?: string;
  submitLabel: string;
  submitHint: string;
  onSubmit: (form: SongFormValues, files: SongFiles, note: string) => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState<SongFormValues>(initial);
  const [files, setFiles] = useState<SongFiles>({});
  const [note, setNote] = useState("");

  const set = (field: string, value: string | boolean) => setForm(f => ({ ...f, [field]: value }));

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form, files, note); }}>
      <section className="step">
        <h2><span className="n">1</span>{t("The song")}</h2>
        <p className="hint">{t("What a worship leader needs to find it and decide if it fits Sunday.")}</p>
        <div className="step-body">
          <div className="field">
            <label htmlFor="title">{t("Title")}</label>
            <input type="text" id="title" required value={form.title} onChange={e => set("title", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="writers">{t("Writer(s)")}</label>
            <input type="text" id="writers" placeholder={t("Every co-writer, exactly as it should appear on chord charts")} required value={form.writer} onChange={e => set("writer", e.target.value)} />
          </div>
          <div className="field-row field">
            <div>
              <label htmlFor="year">{t("Year written")}</label>
              <input type="number" id="year" min={1000} max={new Date().getFullYear()} placeholder={t("e.g. 2025")} value={form.year} onChange={e => set("year", e.target.value)} />
            </div>
            <div>
              <label htmlFor="key">{t("Original key")}</label>
              <select id="key" value={form.songKey} onChange={e => set("songKey", e.target.value)}>
                {[
                  "C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B", "Am", "Bm", "Cm", "Dm", "Em", "F#m", "Gm"
                ].map(k => <option key={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="bpm">{t("Tempo (BPM)")}</label>
              <input type="number" id="bpm" min={30} max={220} placeholder={t("e.g. 72")} value={form.bpm} onChange={e => set("bpm", e.target.value)} />
            </div>
          </div>
          <div className="field-row field">
            <div>
              <label htmlFor="themes">{t("Themes")}</label>
              <input type="text" id="themes" placeholder="Advent, Comfort, Hope" value={form.themes} onChange={e => set("themes", e.target.value)} />
            </div>
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
            </div>
          )}
        </div>
      </section>

      <section className="step">
        <h2><span className="n">2</span>{t("Files")}</h2>
        <p className="hint">{t("Optional — but a demo recording is the single best thing you can give a worship leader deciding at 10pm on a Thursday.")}</p>
        <div className="step-body dz-row">
          <Dropzone label="Demo recording" hint="Drop an MP3 or WAV, or click to choose · a phone recording is fine" accept="audio/*,.mp3,.wav" testId="file-demo" onFile={f => setFiles(x => ({ ...x, demoAudio: f }))} />
          <Dropzone label="Sheet music" hint="Lead sheet or vocal score · PDF or MusicXML" accept=".pdf,.xml,.musicxml" testId="file-sheet" onFile={f => setFiles(x => ({ ...x, sheetPdf: f }))} />
          <Dropzone label="Multitracks" hint="ZIP of stems — one WAV or MP3 per part, every file starting at bar 1 · include click & guide if you have them" accept=".zip" testId="file-stems" onFile={f => setFiles(x => ({ ...x, stemsZip: f }))} />
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

      <section className="step">
        <h2><span className="n">3</span>{t("What you’re giving")}</h2>
        <p className="hint">{t("Both options make the song free for worship forever. They differ in what you keep.")}</p>
        <div className="step-body">
          <label className="choice">
            <input type="radio" name="license" value="wc" checked={form.license === "wc"} onChange={() => set("license", "wc")} />
            <span>
              <strong>{t("Free for worship")}</strong> <span className="free-badge">{t("Recommended")}</span>
              <p>{t("Churches sing it free, forever. You keep every commercial right — recordings, sheet-music sales, sync, concerts, radio.")} <Link to="/license">{t("Read the license.")}</Link></p>
            </span>
          </label>
          <label className="choice">
            <input type="radio" name="license" value="pd" checked={form.license === "pd"} onChange={() => set("license", "pd")} />
            <span>
              <strong>{t("Public domain")}</strong> <span className="pd-badge">{t("Everything, everyone")}</span>
              <p>{t("You give up every right, everywhere, for every use — worship, commercial, all of it, permanently, via the CC0 public-domain dedication so it holds even where local law resists. The song joins the same commons as the hymns.")}</p>
            </span>
          </label>
        </div>
      </section>

      <section className="step">
        <h2><span className="n">4</span>{t("Your word")}</h2>
        <div className="step-body">
          <div className="field">
            <label htmlFor="pro">{t("Collecting societies & licensing admins")}</label>
            <select id="pro" required value={form.proAnswer} onChange={e => set("proAnswer", e.target.value)}>
              <option value="">{t("Are you a member of one?…")}</option>
              {/* value stays English so submissions read the same for reviewers */}
              {["No — nobody else administers my songs", "Yes — ASCAP, BMI, or SESAC", "Yes — GEMA, PRS, or another society outside the U.S.", "Yes — a publisher or licensing admin administers this song"]
                .map(o => <option key={o} value={o}>{t(o)}</option>)}
            </select>
            <p className="hint">{t("U.S.-style societies leave you free to give your own song away. Many societies elsewhere (GEMA and others) take over your performance rights when you join — if that’s you, check your membership terms before sharing, or this grant may not be yours to make.")}</p>
          </div>
          <div className="certify">
            <input type="checkbox" id="certify" required checked={form.certified} onChange={e => set("certified", e.target.checked)} />
            <label htmlFor="certify" style={{ fontWeight: 400, fontSize: "0.9375rem", margin: 0, cursor: "pointer" }}>
              <em>{t("I wrote this song or control its copyright — words, music, and every file I’m uploading — and every co-writer, publisher, and recording owner is on board. No society, publisher, or admin has taken away my right to make this grant. I release the song under the license I chose, permanently. I let WorshipCommons host, convert, transpose, show my name, and deliver these files, including to the tools churches use. I can ask you to stop hosting; copies already out keep the license. If I was wrong, that’s on me — not the churches that trusted it, and not WorshipCommons.")}</em>
              <span className="hint" style={{ display: "block", marginTop: 8 }}>{t("This promise is the whole trust model of the commons. If a song gets shared by someone who doesn’t own it, the")} <Link to="/report">{t("reporting process")}</Link> {t("makes it right.")}</span>
            </label>
          </div>
          {noteLabel && (
            <div className="field" style={{ marginTop: 20 }}>
              <label htmlFor="edit-note">{t(noteLabel)}</label>
              <textarea id="edit-note" data-testid="edit-note" rows={3} required value={note} onChange={e => setNote(e.target.value)} />
            </div>
          )}
        </div>
      </section>

      {error && <p className="hint" style={{ color: "var(--secondary)", fontWeight: 600 }} data-testid="upload-error">{error}</p>}
      <div className="submit-row">
        <button type="submit" className="btn btn-primary">{t(submitLabel)}</button>
        <p className="hint">{t(submitHint)}</p>
      </div>
    </form>
  );
}
