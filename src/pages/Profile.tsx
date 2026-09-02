import { useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import { wcGet, wcPut } from "../api";
import { usePageMeta } from "../seo";
import { useI18n } from "../i18n";
import type { WriterLink } from "./Writer";

const BIO_MAX = 2000;
const LINKS_MAX = 5;

interface Profile {
  id?: string;
  name?: string;
  bio?: string;
  links?: WriterLink[];
}

const blank = { label: "", url: "" };

export default function Profile() {
  const { t } = useI18n();
  usePageMeta(t("Writer profile — WorshipCommons"));
  const { user } = useAuth();
  const location = useLocation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bio, setBio] = useState("");
  const [links, setLinks] = useState<WriterLink[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    wcGet("/authors/mine", true).then((mine: Profile) => {
      setProfile(mine || {});
      setBio(mine?.bio || "");
      setLinks(mine?.links?.length ? mine.links : [{ ...blank }]);
    }).catch(() => setProfile({}));
  }, [user]);

  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;

  const setLink = (i: number, field: keyof WriterLink, value: string) =>
    setLinks(ls => ls.map((l, n) => n === i ? { ...l, [field]: value } : l));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setStatus("");
    setBusy(true);
    try {
      const saved: Profile = await wcPut("/authors/mine", { bio, links: links.filter(l => l.url.trim()) }, true);
      setProfile(saved);
      setLinks(saved.links?.length ? saved.links : [{ ...blank }]);
      setStatus(t("Saved."));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="wrap-narrow" style={{ maxWidth: 640 }}>
      <div className="page-head">
        <span className="eyebrow">{t("Writer profile")}</span>
        <h1>{t("Your writer page")}</h1>
        <p className="lede">{t("This is what churches see when they follow your name from one of your songs.")}</p>
      </div>

      {!profile && <p>{t("Loading…")}</p>}

      {profile && !profile.id && (
        <div className="card" style={{ padding: 32, textAlign: "center" }} data-testid="no-writer-page">
          <p style={{ marginBottom: 16 }}>{t("You’ll have a writer page once one of your songs is live and credits you on your own.")}</p>
          <Link to="/upload" className="btn btn-primary">{t("Share a song")}</Link>
        </div>
      )}

      {profile?.id && (
        <>
          <form className="card" style={{ padding: 32 }} onSubmit={save}>
            <div className="field">
              <label htmlFor="bio">{t("About you")}</label>
              <textarea id="bio" data-testid="profile-bio" rows={6} maxLength={BIO_MAX} placeholder={t("A few sentences about who you are and the songs you write.")} value={bio} onChange={e => setBio(e.target.value)} />
              <p className="hint">{t("{count} of {max} characters.", { count: bio.length, max: BIO_MAX })}</p>
            </div>

            <label>{t("Links")}</label>
            {links.map((l, i) => (
              <div className="field-row field" key={i} style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: 12, alignItems: "start" }}>
                <input type="text" aria-label={t("Link label")} data-testid="profile-link-label" placeholder={t("Label")} maxLength={60} value={l.label || ""} onChange={e => setLink(i, "label", e.target.value)} />
                <input type="url" aria-label={t("Link address")} data-testid="profile-link-url" placeholder="https://" value={l.url} onChange={e => setLink(i, "url", e.target.value)} />
                <button type="button" className="btn btn-ghost" data-testid="profile-link-remove" onClick={() => setLinks(ls => ls.length > 1 ? ls.filter((_, n) => n !== i) : [{ ...blank }])}>{t("Remove")}</button>
              </div>
            ))}
            {links.length < LINKS_MAX && (
              <button type="button" className="btn btn-ghost" data-testid="profile-link-add" onClick={() => setLinks(ls => [...ls, { ...blank }])}>{t("Add a link")}</button>
            )}

            {error && <p className="hint" style={{ color: "var(--secondary)", fontWeight: 600, marginTop: 16 }} data-testid="profile-error">{error}</p>}
            {status && <p className="hint" style={{ fontWeight: 600, marginTop: 16 }} data-testid="profile-status">{status}</p>}

            <button type="submit" className="btn btn-primary" data-testid="profile-save" disabled={busy} style={{ marginTop: 20 }}>{busy ? t("Saving…") : t("Save profile")}</button>
          </form>

          <p className="hint" style={{ marginTop: 16 }}>
            <Link to={`/writers/${encodeURIComponent(profile.id)}`} data-testid="view-writer-page">{t("View your writer page")}</Link>
          </p>
        </>
      )}
    </main>
  );
}
