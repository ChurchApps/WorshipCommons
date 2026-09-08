import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useI18n } from "../i18n";
import type { Song } from "../songs";
import { addToSetlist, createSetlist, removeFromSetlist, useSetlists } from "../setlists";
import "../styles/setlist.css";

/** The song-page picker: drop the song, in the key on screen, into any setlist in this browser. Works signed-out. */
export default function AddToSetlist({ song }: { song: Song }) {
  const { t } = useI18n();
  const lists = useSetlists();
  const [params] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const box = useRef<HTMLDivElement>(null);
  // the key the page is showing wins; else the package's recommended key; else the chart's own
  const key = params.get("key") || song.recommendedKey || song.songKey;
  const inLists = lists.filter(l => l.items.some(i => i.songId === song.id));

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const toggle = (id: string, has: boolean) => (has ? removeFromSetlist(id, song.id) : addToSetlist(id, { songId: song.id, key, capo: 0 }));
  const create = () => {
    if (!name.trim()) return;
    createSetlist(name, [{ songId: song.id, key, capo: 0 }]);
    setName("");
  };

  const label = inLists.length === 0 ? t("+ Add to setlist") : inLists.length === 1 ? t("✓ In {name}", { name: inLists[0].name }) : t("✓ In {n} setlists", { n: inLists.length });

  return (
    <div className="setlist-picker" ref={box}>
      <button type="button" className={"btn " + (inLists.length ? "btn-ghost" : "btn-primary")} data-testid="add-to-setlist" data-song={song.id} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)}>{label}</button>
      {open && (
        <div className="setlist-popover" role="dialog" aria-label={t("Add to setlist")} data-testid="setlist-popover">
          <p className="setlist-popover-head">{t("Add to setlist")} <span className="hint">{t("Key of {key}", { key })}</span></p>
          {lists.length === 0 && <p className="hint">{t("No setlists yet — name your first one below.")}</p>}
          <ul className="setlist-options">
            {lists.map(l => {
              const has = l.items.some(i => i.songId === song.id);
              return (
                <li key={l.id}>
                  <button type="button" className={"setlist-option" + (has ? " on" : "")} data-testid="setlist-option" data-id={l.id} aria-pressed={has} onClick={() => toggle(l.id, has)}>
                    <span>{has ? "✓ " : ""}{l.name}</span><span className="hint">{t("{n} songs", { n: l.items.length })}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <form className="setlist-new" onSubmit={e => { e.preventDefault(); create(); }}>
            <input type="text" value={name} placeholder={t("New setlist…")} aria-label={t("New setlist name")} data-testid="setlist-new-name" onChange={e => setName(e.target.value)} />
            <button type="submit" className="btn btn-primary" data-testid="setlist-new-create" disabled={!name.trim()}>{t("Create")}</button>
          </form>
          {inLists.length > 0 && <p className="hint"><Link to={`/setlists/${inLists[inLists.length - 1].id}`} data-testid="open-setlist">{t("Open {name} →", { name: inLists[inLists.length - 1].name })}</Link></p>}
        </div>
      )}
    </div>
  );
}
