import { useEffect, useRef, useState } from "react";

// controlled ABC textarea with live abcjs engraving + parser warnings
export default function AbcEditor({ value, onChange, rows = 12 }:
  { value: string; onChange: (v: string) => void; rows?: number }) {
  const [warnings, setWarnings] = useState<string[]>([]);
  const paperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!paperRef.current) return;
    if (value.trim() === "") { paperRef.current.innerHTML = ""; setWarnings([]); return; }
    let stale = false;
    import("abcjs").then(m => {
      if (stale || !paperRef.current) return;
      const [tune] = m.default.renderAbc(paperRef.current, value, { responsive: "resize" });
      setWarnings((tune as any)?.warnings || []);
    });
    return () => { stale = true; };
  }, [value]);

  return (
    <>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
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
    </>
  );
}
