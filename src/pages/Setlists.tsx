import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loadSongs, Song } from "../songs";
import { createSetlist, deleteSetlist, duplicateSetlist, durationSeconds, formatMinutes, shareUrl, updateSetlist, useSetlists, type Setlist } from "../setlists";
import { usePageMeta } from "../seo";
import { useI18n } from "../i18n";
import "../styles/setlist.css";

function Row({ setlist, songs }: { setlist: Setlist; songs: Song[] }) {
  const { t, lang } = useI18n();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(setlist.name);
  const [copied, setCopied] = useState(false);
  const duration = durationSeconds(setlist.items, songs);

  const rename = () => {
    setRenaming(false);
    if (name.trim() && name.trim() !== setlist.name) updateSetlist(setlist.id, s => ({ ...s, name: name.trim() }));
    else setName(setlist.name);
  };
  const share = async () => {
    try { await navigator.clipboard.writeText(shareUrl(setlist)); } catch { /* clipboard blocked: the detail page shows the link */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const remove = () => { if (confirm(t("Delete “{name}”?", { name: setlist.name }))) deleteSetlist(setlist.id); };

  return (
    <div className="card setlist-row" data-testid="setlist-row" data-id={setlist.id}>
      <div className="setlist-row-main">
        {renaming
          ? <input type="text" value={name} autoFocus aria-label={t("Setlist name")} data-testid="setlist-rename-input" onChange={e => setName(e.target.value)} onBlur={rename} onKeyDown={e => { if (e.key === "Enter") rename(); if (e.key === "Escape") { setName(setlist.name); setRenaming(false); } }} />
          : <h3><Link to={`/setlists/${setlist.id}`} data-testid="setlist-name">{setlist.name}</Link></h3>}
        <p className="hint" data-testid="setlist-meta">
          {t("{n} songs", { n: setlist.items.length })} · <span data-testid="setlist-duration">{duration.approx ? "≈ " : ""}{t("{n} min", { n: formatMinutes(duration.seconds) })}</span> · {t("Updated {date}", { date: new Date(setlist.updatedAt).toLocaleDateString(lang) })}
        </p>
      </div>
      <div className="setlist-row-actions">
        <button type="button" className="chip" data-testid="setlist-share" onClick={share}>{copied ? t("Link copied ✓") : t("Share")}</button>
        <button type="button" className="chip" data-testid="setlist-rename" onClick={() => setRenaming(true)}>{t("Rename")}</button>
        <button type="button" className="chip" data-testid="setlist-duplicate" onClick={() => duplicateSetlist(setlist.id)}>{t("Duplicate")}</button>
        <button type="button" className="chip" data-testid="setlist-delete" onClick={remove}>{t("Delete")}</button>
      </div>
    </div>
  );
}

export default function Setlists() {
  const { t } = useI18n();
  usePageMeta(t("Setlists — WorshipCommons"), t("Build a set for Sunday: order the songs, pick the keys and verses, share a link with the band, download the pack."));
  const lists = useSetlists();
  const [songs, setSongs] = useState<Song[]>([]);
  const [name, setName] = useState("");
  useEffect(() => { loadSongs().then(setSongs).catch(() => {}); }, []);

  const create = () => {
    if (!name.trim()) return;
    createSetlist(name);
    setName("");
  };

  return (
    <main className="wrap-narrow">
      <div className="page-head">
        <span className="eyebrow">{t("Setlists")}</span>
        <h1>{t("Your setlists")}</h1>
        <p className="lede">{t("Order the songs, pick a key and the verses for each, and share one link with the band — no account needed to open it.")}</p>
        <p className="hint">{t("Setlists live in this browser. A share link carries the whole set, so save the link if you switch devices.")}</p>
      </div>

      <form className="card setlist-create" onSubmit={e => { e.preventDefault(); create(); }}>
        <input type="text" value={name} placeholder={t("Name the set — Sunday 14 Sept, Youth night…")} aria-label={t("Setlist name")} data-testid="new-setlist-name" onChange={e => setName(e.target.value)} />
        <button type="submit" className="btn btn-primary" data-testid="new-setlist" disabled={!name.trim()}>{t("Create setlist")}</button>
      </form>

      {lists.length === 0 && (
        <div className="card" style={{ padding: 32, textAlign: "center" }} data-testid="setlists-empty">
          <p style={{ marginBottom: 16 }}>{t("No setlists yet. Open any song and press “+ Add to setlist”, or name one above.")}</p>
          <Link to="/songs" className="btn btn-primary">{t("Explore the songs")}</Link>
        </div>
      )}
      {lists.map(s => <Row key={s.id} setlist={s} songs={songs} />)}
    </main>
  );
}
