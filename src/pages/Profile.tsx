import React, { useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import { writerPath } from "../songs";
import { wcGet, wcPut } from "../api";
import { usePageMeta } from "../seo";
import { useI18n } from "../i18n";
import type { WriterLink } from "../components/SupportWriter";
import { EmptyState } from "../components/EmptyState";

const BIO_MAX = 2000;
const LINKS_MAX = 5;

interface Profile {
  id?: string;
  name?: string;
  bio?: string;
  links?: WriterLink[];
  supportLinks?: WriterLink[];
}

const blank = { label: "", url: "" };

interface LinkRowsProps {
  items: WriterLink[];
  onChange: (next: WriterLink[]) => void;
  testId: string;
  addLabel: string;
}

const LinkRows: React.FC<LinkRowsProps> = (props) => {
  const { t } = useI18n();
  const setField = (i: number, field: keyof WriterLink, value: string) =>
    props.onChange(props.items.map((l, n) => n === i ? { ...l, [field]: value } : l));
  return (
    <>
      {props.items.map((l, i) => (
        <div className="field-row field" key={i} style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: 12, alignItems: "start" }}>
          <input type="text" aria-label={t("Link label")} data-testid={`${props.testId}-label`} placeholder={t("Label")} maxLength={60} value={l.label || ""} onChange={e => setField(i, "label", e.target.value)} />
          <input type="url" aria-label={t("Link address")} data-testid={`${props.testId}-url`} placeholder="https://" value={l.url} onChange={e => setField(i, "url", e.target.value)} />
          <button type="button" className="btn btn-ghost" data-testid={`${props.testId}-remove`} onClick={() => props.onChange(props.items.length > 1 ? props.items.filter((_, n) => n !== i) : [{ ...blank }])}>{t("Remove")}</button>
        </div>
      ))}
      {props.items.length < LINKS_MAX && (
        <button type="button" className="btn btn-ghost" data-testid={`${props.testId}-add`} onClick={() => props.onChange([...props.items, { ...blank }])}>{props.addLabel}</button>
      )}
    </>
  );
};

export const Profile: React.FC = () => {
  const { t } = useI18n();
  usePageMeta(t("Writer profile — WorshipCommons"));
  const { user } = useAuth();
  const location = useLocation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bio, setBio] = useState("");
  const [links, setLinks] = useState<WriterLink[]>([]);
  const [supportLinks, setSupportLinks] = useState<WriterLink[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    wcGet("/authors/mine", true).then((mine: Profile) => {
      setProfile(mine || {});
      setBio(mine?.bio || "");
      setLinks(mine?.links?.length ? mine.links : [{ ...blank }]);
      setSupportLinks(mine?.supportLinks?.length ? mine.supportLinks : [{ ...blank }]);
    }).catch(() => setProfile({}));
  }, [user]);

  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setStatus("");
    setBusy(true);
    try {
      const saved: Profile = await wcPut("/authors/mine", {
        bio,
        links: links.filter(l => l.url.trim()),
        supportLinks: supportLinks.filter(l => l.url.trim())
      }, true);
      setProfile(saved);
      setLinks(saved.links?.length ? saved.links : [{ ...blank }]);
      setSupportLinks(saved.supportLinks?.length ? saved.supportLinks : [{ ...blank }]);
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
        <EmptyState testId="no-writer-page" message={t("You’ll have a writer page once one of your songs is live and credits you on your own.")} to="/upload" action={t("Share a song")} />
      )}

      {profile?.id && (
        <>
          <form className="card" style={{ padding: 32 }} onSubmit={handleSave}>
            <div className="field">
              <label htmlFor="bio">{t("About you")}</label>
              <textarea id="bio" data-testid="profile-bio" rows={6} maxLength={BIO_MAX} placeholder={t("A few sentences about who you are and the songs you write.")} value={bio} onChange={e => setBio(e.target.value)} />
              <p className="hint">{t("{count} of {max} characters.", { count: bio.length, max: BIO_MAX })}</p>
            </div>

            <label>{t("Links")}</label>
            <LinkRows items={links} onChange={setLinks} testId="profile-link" addLabel={t("Add a link")} />

            <label style={{ marginTop: 20 }}>{t("Support links")}</label>
            <p className="hint">{t("Worship use is free. If you want churches to support your other work, add the places they should go — a site, a store, a ministry page. Not a condition of the grant.")}</p>
            <LinkRows items={supportLinks} onChange={setSupportLinks} testId="profile-support" addLabel={t("Add a support link")} />

            {error && <p className="hint" style={{ color: "var(--secondary)", fontWeight: 600, marginTop: 16 }} data-testid="profile-error">{error}</p>}
            {status && <p className="hint" style={{ fontWeight: 600, marginTop: 16 }} data-testid="profile-status">{status}</p>}

            <button type="submit" className="btn btn-primary" data-testid="profile-save" disabled={busy} style={{ marginTop: 20 }}>{busy ? t("Saving…") : t("Save profile")}</button>
          </form>

          <p className="hint" style={{ marginTop: 16 }}>
            <Link to={writerPath(profile.id, profile.name || "")} data-testid="view-writer-page">{t("View your writer page")}</Link>
          </p>
        </>
      )}
    </main>
  );
};
