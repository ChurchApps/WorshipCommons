import { useState } from "react";
import { Link } from "react-router-dom";
import { wcPost } from "../api";
import "../styles/report.css";

export default function Report() {
  const [form, setForm] = useState({ songText: "", reporterRole: "", details: "", name: "", email: "", signature: "", goodfaith: false });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const set = (field: string, value: string | boolean) => setForm(f => ({ ...f, [field]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await wcPost("/reports", {
        songText: form.songText,
        reporterRole: form.reporterRole,
        details: form.details,
        name: form.name,
        email: form.email,
        signature: form.signature
      });
      setSubmitted(true);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <main className="wrap-narrow">
      <div className="page-head">
        <span className="eyebrow">Keep the commons honest</span>
        <h1>Report a song</h1>
        <p className="lede">The commons runs on one promise: whoever shares a song actually owns it. If someone gave away a song that wasn&apos;t theirs — especially if it&apos;s yours — tell us and we&apos;ll make it right.</p>
      </div>

      <div className="process">
        <div className="card"><span className="n">1</span><b>You report it</b><p>Point us at the song and tell us why the sharing wasn&apos;t legit. Ownership claims jump the queue.</p></div>
        <div className="card"><span className="n">2</span><b>We review it</b><p>A real person contacts the uploader, hears both sides, checks the claim, and pulls the song from the library while ownership is genuinely in dispute.</p></div>
        <div className="card"><span className="n">3</span><b>We make it right</b><p>Bad uploads come down, the uploader loses their account and answers for the mistake, and every church that downloaded the song hears from us right away.</p></div>
      </div>

      {submitted ? (
        <div className="thanks card show" data-testid="report-thanks">
          <span className="free-badge">Report received</span>
          <h2 style={{ marginTop: 16 }}>Thanks for guarding the commons</h2>
          <p>A real person will get back to you within two business days — ownership claims are read first.</p>
          <Link to="/songs" className="btn btn-ghost">Back to the library</Link>
        </div>
      ) : (
        <form className="report-form" onSubmit={submit}>
          <div className="field">
            <label htmlFor="song">Which song?</label>
            <input type="text" id="song" placeholder="Title or the song page's address" required value={form.songText} onChange={e => set("songText", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="relation">Who are you?</label>
            <select id="relation" required value={form.reporterRole} onChange={e => set("reporterRole", e.target.value)}>
              <option value="">Choose one…</option>
              <option>The copyright owner (writer or publisher)</option>
              <option>Someone authorized by the copyright owner</option>
              <option>A co-writer who never agreed to this</option>
              <option>Someone who recognizes this song and suspects a problem</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="details">What&apos;s wrong?</label>
            <textarea id="details" rows={6} placeholder="Tell us what this song is, who actually owns it, and how you know. Links to registrations, releases, or publisher catalogs help us move fast." required value={form.details} onChange={e => set("details", e.target.value)} />
          </div>
          <div className="field-row field" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <label htmlFor="name">Your name</label>
              <input type="text" id="name" required value={form.name} onChange={e => set("name", e.target.value)} />
            </div>
            <div>
              <label htmlFor="email">Email</label>
              <input type="email" id="email" required value={form.email} onChange={e => set("email", e.target.value)} />
            </div>
          </div>

          <div className="certify">
            <input type="checkbox" id="goodfaith" required checked={form.goodfaith} onChange={e => set("goodfaith", e.target.checked)} />
            <label htmlFor="goodfaith" style={{ fontWeight: 400, fontSize: "0.9375rem", margin: 0, cursor: "pointer" }}>
              <em>I believe in good faith that this song was shared without the owner&apos;s permission, and everything in this report is accurate. If I&apos;m claiming to be the owner or their agent, I make that claim under penalty of perjury.</em>
              <span className="hint" style={{ display: "block", marginTop: 8 }}>The legal-sounding sentence is the one part we can&apos;t soften — it&apos;s what makes takedowns enforceable.</span>
            </label>
          </div>

          <div className="field" style={{ marginTop: 26 }}>
            <label htmlFor="signature">Signature</label>
            <input type="text" id="signature" placeholder="Type your full legal name" required value={form.signature} onChange={e => set("signature", e.target.value)} />
          </div>

          {error && <p className="hint" style={{ color: "var(--secondary)", fontWeight: 600 }}>{error}</p>}
          <button type="submit" className="btn btn-primary">Send the report</button>
        </form>
      )}
    </main>
  );
}
