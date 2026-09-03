import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import ChordProPreview from "../components/ChordProPreview";
import { wcGet } from "../api";
import { licenseById } from "../licenses";
import "../styles/song.css";

interface PreviewFile { name: string; action?: string; url?: string }
interface Preview { payload?: { name?: string; tags?: string; language?: string; license?: string; licenseVersion?: string; detail?: Record<string, any> }; note?: string; files?: PreviewFile[] }

// read-only render of a proposed submission — token-gated for reviewers, owner JWT when no token
export default function PreviewSubmission() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState(false);
  const abcRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    const token = params.get("token");
    const req = params.has("token")
      ? wcGet(`/submissions/${id}/preview?token=${encodeURIComponent(token || "")}`)
      : wcGet(`/submissions/${id}`, true);
    req.then(setPreview).catch(() => setError(true));
  }, [id, params]);

  const files = Array.isArray(preview?.files) ? preview.files : [];
  const abcUrl = files.find(f => f.name === "tune.abc" && f.action !== "remove")?.url;
  const audio = files.find(f => f.name.startsWith("demoAudio.") && f.action !== "remove");

  useEffect(() => {
    if (!abcUrl || !abcRef.current) return;
    let stale = false;
    Promise.all([fetch(abcUrl).then(r => r.text()), import("abcjs")]).then(([text, m]) => {
      if (!stale && abcRef.current) m.default.renderAbc(abcRef.current, text, { responsive: "resize" });
    }).catch(() => {});
    return () => { stale = true; };
  }, [abcUrl]);

  if (error) return <main style={{ padding: 40 }}>Preview unavailable.</main>;
  if (!preview) return <main style={{ padding: 40 }}>Loading…</main>;

  const p = preview.payload || {};
  const d = p.detail || {};

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px" }}>
      <h1 style={{ marginBottom: 4 }}>{p.name}</h1>
      <p className="hint">{d.writer}{d.year ? ` · ${d.year}` : ""}</p>
      <ul className="dl-list" data-testid="preview-meta">
        <li>Key {d.songKey}{d.bpm ? ` · ${d.bpm} BPM` : ""}{d.timeSignature ? ` · ${d.timeSignature}` : ""}</li>
        <li data-testid="preview-license">{p.language} · {licenseById(p.license).label}{p.licenseVersion ? ` ${p.licenseVersion}` : ""}{p.tags ? ` · ${p.tags}` : ""}</li>
        {licenseById(p.license).must.length > 0 && <li data-testid="preview-must">You must: {licenseById(p.license).must.join(" · ")}</li>}
        {d.scripture && <li>{d.scripture}</li>}
        {preview.note && <li>{preview.note}</li>}
      </ul>
      {audio?.url && <audio controls src={audio.url} style={{ width: "100%", margin: "16px 0" }} data-testid="preview-audio" />}
      {abcUrl && <div ref={abcRef} data-testid="preview-abc" />}
      <div data-testid="preview-chart"><ChordProPreview chordPro={d.chordPro || ""} /></div>
    </main>
  );
}
