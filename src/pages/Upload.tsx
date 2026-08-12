import { useRef, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import { wcPost } from "../api";
import "../styles/upload.css";
import { usePageMeta } from "../seo";

interface Attached { name: string; contentType: string; base64: string; size: number; }

function Dropzone({ label, hint, accept, testId, onFile }: { label: string; hint: string; accept: string; testId: string; onFile: (f: Attached) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [attached, setAttached] = useState<Attached | null>(null);

  const pick = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result).split(",")[1] || "";
      const f = { name: file.name, contentType: file.type || "application/octet-stream", base64, size: file.size };
      setAttached(f);
      onFile(f);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="dropzone" tabIndex={0} role="button" aria-label={`Upload ${label}`} onClick={() => inputRef.current?.click()} onKeyDown={e => { if (e.key === "Enter") inputRef.current?.click(); }}>
      <input ref={inputRef} type="file" accept={accept} data-testid={testId} style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) pick(e.target.files[0]); }} />
      {attached
        ? <><b>Attached ✓</b>{attached.name} · {(attached.size / 1024).toFixed(0)} KB</>
        : <><b>{label}</b>{hint}</>}
    </div>
  );
}

export default function Upload() {
  usePageMeta("Share your song — WorshipCommons");
  const { user } = useAuth();
  const location = useLocation();
  const [form, setForm] = useState({ title: "", writer: "", year: "", songKey: "D", bpm: "", themes: "", language: "English", scripture: "", chordPro: "", license: "wc", proAnswer: "", certified: false });
  const [files, setFiles] = useState<{ demoAudio?: Attached; sheetPdf?: Attached; stemsZip?: Attached }>({});
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;

  const set = (field: string, value: string | boolean) => setForm(f => ({ ...f, [field]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await wcPost("/songs", {
        title: form.title,
        writer: form.writer,
        year: form.year ? Number(form.year) : undefined,
        songKey: form.songKey,
        bpm: form.bpm ? Number(form.bpm) : undefined,
        themes: form.themes,
        language: form.language,
        scripture: form.scripture,
        chordPro: form.chordPro,
        license: form.license === "pd" ? "PD" : "WC",
        proAnswer: form.proAnswer,
        certified: form.certified,
        files: {
          demoAudio: files.demoAudio && { name: files.demoAudio.name, contentType: files.demoAudio.contentType, base64: files.demoAudio.base64 },
          sheetPdf: files.sheetPdf && { name: files.sheetPdf.name, contentType: files.sheetPdf.contentType, base64: files.sheetPdf.base64 },
          stemsZip: files.stemsZip && { name: files.stemsZip.name, contentType: files.stemsZip.contentType, base64: files.stemsZip.base64 }
        }
      }, true);
      setSubmitted(true);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (submitted) {
    return (
      <main className="wrap-narrow">
        <div className="thanks card show" data-testid="upload-thanks">
          <span className="free-badge">Received</span>
          <h2 style={{ marginTop: 16 }}>Thank you — it&apos;s in review</h2>
          <p>A human reviews every song — usually within a few days. Track it on <Link to="/my-songs">My songs</Link>. The church will be glad to sing it.</p>
          <Link to="/songs" className="btn btn-ghost">Back to the library</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="wrap-narrow">
      <div className="page-head">
        <span className="eyebrow">Share a song</span>
        <h1>Give the church something to sing</h1>
        <p className="lede">Four quick steps: the song, its files, what you&apos;re giving, and your word that it&apos;s yours to give. A human reviews every song before it goes live — usually within a few days. Prefer to release a song without uploading it? <Link to="/license#release">Copy the release notice.</Link></p>
      </div>

      <form onSubmit={submit}>
        <section className="step">
          <h2><span className="n">1</span>The song</h2>
          <p className="hint">What a worship leader needs to find it and decide if it fits Sunday.</p>
          <div className="step-body">
            <div className="field">
              <label htmlFor="title">Title</label>
              <input type="text" id="title" required value={form.title} onChange={e => set("title", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="writers">Writer(s)</label>
              <input type="text" id="writers" placeholder="Every co-writer, exactly as it should appear on chord charts" required value={form.writer} onChange={e => set("writer", e.target.value)} />
            </div>
            <div className="field-row field">
              <div>
                <label htmlFor="year">Year written</label>
                <input type="number" id="year" min={1000} max={2026} placeholder="2025" value={form.year} onChange={e => set("year", e.target.value)} />
              </div>
              <div>
                <label htmlFor="key">Original key</label>
                <select id="key" value={form.songKey} onChange={e => set("songKey", e.target.value)}>
                  {[
                    "C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B", "Am", "Bm", "Cm", "Dm", "Em", "F#m", "Gm"
                  ].map(k => <option key={k}>{k}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="bpm">Tempo (BPM)</label>
                <input type="number" id="bpm" min={30} max={220} placeholder="72" value={form.bpm} onChange={e => set("bpm", e.target.value)} />
              </div>
            </div>
            <div className="field-row field">
              <div>
                <label htmlFor="themes">Themes</label>
                <input type="text" id="themes" placeholder="Advent, Comfort, Hope" value={form.themes} onChange={e => set("themes", e.target.value)} />
              </div>
              <div>
                <label htmlFor="lang">Language</label>
                <input type="text" id="lang" value={form.language} onChange={e => set("language", e.target.value)} />
              </div>
              <div>
                <label htmlFor="scripture">Scripture reference</label>
                <input type="text" id="scripture" placeholder="Isaiah 40:4" value={form.scripture} onChange={e => set("scripture", e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="lyrics">Lyrics and chords</label>
              <textarea id="lyrics" rows={9} placeholder="ChordPro welcome — [D]Every valley [G]shall be [D]lifted…" required value={form.chordPro} onChange={e => set("chordPro", e.target.value)} />
              <p className="hint">Start each section with its name (Verse 1, Chorus…), chords in [brackets]. We generate the chord chart and downloads from this.</p>
            </div>
          </div>
        </section>

        <section className="step">
          <h2><span className="n">2</span>Files</h2>
          <p className="hint">Optional — but a demo recording is the single best thing you can give a worship leader deciding at 10pm on a Thursday.</p>
          <div className="step-body dz-row">
            <Dropzone label="Demo recording" hint="Drop an MP3 or WAV, or click to choose · a phone recording is fine" accept="audio/*,.mp3,.wav" testId="file-demo" onFile={f => setFiles(x => ({ ...x, demoAudio: f }))} />
            <Dropzone label="Sheet music" hint="Lead sheet or vocal score · PDF or MusicXML" accept=".pdf,.xml,.musicxml" testId="file-sheet" onFile={f => setFiles(x => ({ ...x, sheetPdf: f }))} />
            <Dropzone label="Multitracks" hint="ZIP of stems — one WAV or MP3 per part, every file starting at bar 1 · include click & guide if you have them" accept=".zip" testId="file-stems" onFile={f => setFiles(x => ({ ...x, stemsZip: f }))} />
          </div>
          <p className="hint" style={{ margin: "10px 0 0 52px" }}>Files up to ~35 MB each. Upload stems once, in the recorded key.</p>
        </section>

        <section className="step">
          <h2><span className="n">3</span>What you&apos;re giving</h2>
          <p className="hint">Both options make the song free for worship forever. They differ in what you keep.</p>
          <div className="step-body">
            <label className="choice">
              <input type="radio" name="license" value="wc" checked={form.license === "wc"} onChange={() => set("license", "wc")} />
              <span>
                <strong>Free for worship</strong> <span className="free-badge">Recommended</span>
                <p>Churches sing it free, forever. You keep every commercial right — recordings, sheet-music sales, sync, concerts, radio. <Link to="/license">Read the license — it fits on one page.</Link></p>
              </span>
            </label>
            <label className="choice">
              <input type="radio" name="license" value="pd" checked={form.license === "pd"} onChange={() => set("license", "pd")} />
              <span>
                <strong>Public domain</strong> <span className="pd-badge">Everything, everyone</span>
                <p>You give up every right, everywhere, for every use — worship, commercial, all of it, permanently, via the CC0 public-domain dedication so it holds even where local law resists. The song joins the same commons as the hymns.</p>
              </span>
            </label>
          </div>
        </section>

        <section className="step">
          <h2><span className="n">4</span>Your word</h2>
          <div className="step-body">
            <div className="field">
              <label htmlFor="pro">Collecting societies &amp; licensing admins</label>
              <select id="pro" required value={form.proAnswer} onChange={e => set("proAnswer", e.target.value)}>
                <option value="">Are you a member of one?…</option>
                <option>No — nobody else administers my songs</option>
                <option>Yes — ASCAP, BMI, or SESAC</option>
                <option>Yes — GEMA, PRS, or another society outside the U.S.</option>
                <option>Yes — CCLI or a publisher administers this song</option>
              </select>
              <p className="hint">U.S.-style societies leave you free to give your own song away. Many societies elsewhere (GEMA and others) take over your performance rights when you join — if that&apos;s you, check your membership terms before sharing, or this grant may not be yours to make.</p>
            </div>
            <div className="certify">
              <input type="checkbox" id="certify" required checked={form.certified} onChange={e => set("certified", e.target.checked)} />
              <label htmlFor="certify" style={{ fontWeight: 400, fontSize: "0.9375rem", margin: 0, cursor: "pointer" }}>
                <em>I wrote this song or control its copyright — words, music, and every file I&apos;m uploading — and every co-writer, publisher, and recording owner is on board. By submitting, I grant worshippers everywhere the license I chose above, and I grant WorshipCommons permission to host these files, convert and transpose them, and deliver them to churches. If my promise turns out to be wrong, that&apos;s on me — not the churches that trusted it.</em>
                <span className="hint" style={{ display: "block", marginTop: 8 }}>This promise is the whole trust model of the commons. If a song gets shared by someone who doesn&apos;t own it, the <Link to="/report">reporting process</Link> makes it right.</span>
              </label>
            </div>
          </div>
        </section>

        {error && <p className="hint" style={{ color: "var(--secondary)", fontWeight: 600 }} data-testid="upload-error">{error}</p>}
        <div className="submit-row">
          <button type="submit" className="btn btn-primary">Add it to the commons</button>
          <p className="hint">Reviewed by a human before it appears — usually within a few days.</p>
        </div>
      </form>
    </main>
  );
}
