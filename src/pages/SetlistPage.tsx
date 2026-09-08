import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { loadSong, Song } from "../songs";
import {
  chartShapes, chordProFor, createSetlist, decodeShare, defaultOrder, durationSeconds, formatMinutes, isShareAlike, keyChoices,
  licenseLineFor, packFilesFor, sectionLabels, shareUrl, slugify, transposedSections, updateSetlist, useSetlists, type Setlist, type SetlistItem
} from "../setlists";
import { licenseNotice } from "../licenses";
import { makeZip, textEntry } from "../zip";
import { downloadFile } from "../exports";
import { usePageMeta } from "../seo";
import { useI18n } from "../i18n";
import "../styles/setlist.css";

type Mode = "edit" | "shared" | "stage" | "print";
type SongMap = Map<string, Song | null>;

/** Every song in the set, full detail (chart, form map, published keys, attribution) — always the current package. */
function useSongs(items: SetlistItem[] | undefined): SongMap {
  const ids = [...new Set((items || []).map(i => i.songId))].join(",");
  const [songs, setSongs] = useState<SongMap>(new Map());
  useEffect(() => {
    if (!ids) return;
    let live = true;
    Promise.all(ids.split(",").map(async id => [id, await loadSong(id)] as const)).then(rows => { if (live) setSongs(new Map(rows)); });
    return () => { live = false; };
  }, [ids]);
  return songs;
}

/** One chart, chords over the words, in the key and capo the setlist chose. */
function Chart({ song, item, chords = true }: { song: Song; item: SetlistItem; chords?: boolean }) {
  const sections = useMemo(() => transposedSections(song, item.key, item.capo, item.order), [song, item.key, item.capo, item.order]);
  return (
    <div className="chart">
      {sections.map((st, si) => (
        <section className="chart-section" key={si}>
          <p className="chart-label">{st.label}</p>
          {st.lines.map((line, li) => (
            <p className="chart-line" key={li}>
              {line.map((seg, gi) => (
                <span className="chart-seg" key={gi}>
                  {chords && <span className="chart-chord">{seg.chord || " "}</span>}
                  <span>{seg.text || " "}</span>
                </span>
              ))}
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}

function move<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length || from === to) return arr;
  const next = arr.slice();
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}

function ItemRow({ item, index, count, song, readOnly, onChange, onMove, onRemove, onDrop }: {
  item: SetlistItem; index: number; count: number; song: Song | null | undefined; readOnly: boolean;
  onChange: (patch: Partial<SetlistItem>) => void; onMove: (to: number) => void; onRemove: () => void; onDrop: (from: number) => void;
}) {
  const { t } = useI18n();
  if (song === null) {
    return (
      <div className="card setlist-item setlist-item-gone" data-testid="setlist-item" data-song={item.songId}>
        <p>{t("This song is no longer in the commons.")}</p>
        {!readOnly && <button type="button" className="chip" data-testid="item-remove" onClick={onRemove}>{t("Remove")}</button>}
      </div>
    );
  }
  if (!song) return <div className="card setlist-item" data-testid="setlist-item" data-song={item.songId}><p className="hint">{t("Loading…")}</p></div>;

  const keys = keyChoices(song);
  const picks = item.order ?? defaultOrder(song);
  const labels = sectionLabels(song);
  const { keyLabel, shapeLabel } = chartShapes(song, item.key, item.capo);
  const setPicks = (order: string[]) => onChange({ order });

  return (
    <div className="card setlist-item" data-testid="setlist-item" data-song={song.id} draggable={!readOnly}
      onDragStart={e => { e.dataTransfer.setData("text/plain", String(index)); e.dataTransfer.effectAllowed = "move"; }}
      onDragOver={e => { if (!readOnly) e.preventDefault(); }}
      onDrop={e => { e.preventDefault(); const from = Number(e.dataTransfer.getData("text/plain")); if (!Number.isNaN(from)) onDrop(from); }}>
      <div className="setlist-item-head">
        <span className="setlist-index" aria-hidden="true">{index + 1}</span>
        <div className="setlist-item-title">
          <h3><Link to={`/songs/${song.id}?key=${encodeURIComponent(keyLabel)}`} data-testid="item-title">{song.title}</Link></h3>
          <p className="hint">{song.writer}{song.year ? ` · ${song.year}` : ""}{isShareAlike(song) ? ` · ${t("CC BY-SA")}` : ""}</p>
        </div>
        {!readOnly && (
          <div className="setlist-item-move">
            <button type="button" className="chip" aria-label={t("Move up")} data-testid="move-up" disabled={index === 0} onClick={() => onMove(index - 1)}>↑</button>
            <button type="button" className="chip" aria-label={t("Move down")} data-testid="move-down" disabled={index === count - 1} onClick={() => onMove(index + 1)}>↓</button>
            <button type="button" className="chip" data-testid="item-remove" onClick={onRemove}>{t("Remove")}</button>
          </div>
        )}
      </div>

      {readOnly
        ? (
          <p className="setlist-item-summary" data-testid="item-summary">
            {t("Key of {key}", { key: keyLabel })}{item.capo ? ` · ${t("Capo {n} — {root} shapes", { n: item.capo, root: shapeLabel })}` : ""} · {picks.join(" → ")}{item.arrangement ? ` · ${item.arrangement}` : ""}
          </p>
        )
        : (
          <div className="setlist-item-controls">
            <label>{t("Key")}
              <select value={item.key || song.songKey} data-testid="item-key" onChange={e => onChange({ key: e.target.value })}>
                <optgroup label={t("Published")}>{keys.published.map(k => <option key={k} value={k}>{k}</option>)}</optgroup>
                <optgroup label={t("Preview (any key)")}>{keys.preview.map(k => <option key={k} value={k}>{k}</option>)}</optgroup>
              </select>
            </label>
            <label>{t("Capo")}
              <select value={item.capo} data-testid="item-capo" onChange={e => onChange({ capo: Number(e.target.value) })}>
                <option value={0}>{t("None")}</option>
                {[1, 2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>{t("{n} — {root} shapes", { n, root: chartShapes(song, item.key, n).shapeLabel })}</option>)}
              </select>
            </label>
            <div className="setlist-picks">
              <span className="setlist-picks-label">{t("Sections")}</span>
              <ol className="setlist-pick-list" data-testid="item-picks">
                {picks.map((label, pi) => (
                  <li key={pi} data-testid="pick" data-label={label}>
                    <span>{label}</span>
                    <button type="button" aria-label={t("Move up")} disabled={pi === 0} onClick={() => setPicks(move(picks, pi, pi - 1))}>↑</button>
                    <button type="button" aria-label={t("Move down")} disabled={pi === picks.length - 1} onClick={() => setPicks(move(picks, pi, pi + 1))}>↓</button>
                    <button type="button" aria-label={t("Remove")} data-testid="pick-remove" onClick={() => setPicks(picks.filter((_, j) => j !== pi))}>×</button>
                  </li>
                ))}
              </ol>
              <div className="setlist-pick-add">
                <select value="" aria-label={t("Add a section")} data-testid="pick-add" onChange={e => { if (e.target.value) setPicks([...picks, e.target.value]); }}>
                  <option value="">{t("+ Add section")}</option>
                  {labels.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                {item.order && <button type="button" className="chip" data-testid="pick-reset" onClick={() => onChange({ order: undefined })}>{t("Reset to default")}</button>}
              </div>
            </div>
            <label className="setlist-arrangement">{t("Arrangement")}
              <input type="text" value={item.arrangement || ""} placeholder={t("Chorus ×2 at the end, last verse a cappella…")} data-testid="item-note" onChange={e => onChange({ arrangement: e.target.value })} />
            </label>
          </div>
        )}
    </div>
  );
}

function Editor({ setlist, songs, readOnly }: { setlist: Setlist; songs: SongMap; readOnly: boolean }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [copied, setCopied] = useState<"" | "link" | "chordpro">("");
  const [name, setName] = useState(setlist.name);
  const [packing, setPacking] = useState(false);
  useEffect(() => setName(setlist.name), [setlist.name]);
  usePageMeta(t("{name} — setlist | WorshipCommons", { name: setlist.name }));

  const loaded = setlist.items.map(i => songs.get(i.songId)).filter((s): s is Song => !!s);
  const allLoaded = setlist.items.every(i => songs.has(i.songId));
  const duration = durationSeconds(setlist.items, loaded);
  const saSongs = loaded.filter(isShareAlike);
  const patch = (change: (s: Setlist) => Setlist) => { if (!readOnly) updateSetlist(setlist.id, change); };
  const setItems = (items: SetlistItem[]) => patch(s => ({ ...s, items }));
  const flash = (what: "link" | "chordpro") => { setCopied(what); setTimeout(() => setCopied(""), 2500); };

  const link = shareUrl(setlist);
  const share = async () => {
    try { await navigator.clipboard.writeText(link); } catch { /* the field below stays selectable */ }
    flash("link");
  };
  const copyChordPro = async () => {
    const text = setlist.items.map(i => { const s = songs.get(i.songId); return s ? chordProFor(s, i.key, i.capo, i.order) : ""; }).filter(Boolean).join("\n");
    try { await navigator.clipboard.writeText(text); } catch { /* blocked clipboard: nothing else to do */ }
    flash("chordpro");
  };
  const pack = () => {
    if (packing) return;
    setPacking(true);
    try {
      // CC BY-SA rule: a share-alike song makes the compiled pack share-alike, so it stays out unless the set says so
      const rows = setlist.items.map(i => ({ item: i, song: songs.get(i.songId) })).filter((r): r is { item: SetlistItem; song: Song } => !!r.song && (setlist.shareAlike || !isShareAlike(r.song)));
      const files = rows.flatMap((r, i) => packFilesFor(r.song, r.item, `${String(i + 1).padStart(2, "0")}-${slugify(r.song.title)}`).map(f => textEntry(f.name, f.text)));
      const order = rows.map((r, i) => `${i + 1}. ${r.song.title} — ${chartShapes(r.song, r.item.key, r.item.capo).keyLabel}${r.item.capo ? ` (capo ${r.item.capo})` : ""}${r.item.arrangement ? ` — ${r.item.arrangement}` : ""}`);
      files.push(textEntry("setlist.txt", `${setlist.name}\n\n${order.join("\n")}\n`));
      const notice = setlist.shareAlike && rows.some(r => isShareAlike(r.song)) ? "\n\nThis pack includes CC BY-SA songs. Share the pack, or anything you make from it, under the same license.\n" : "\n";
      files.push(textEntry("LICENSE.txt", `${setlist.name}\n\n${rows.map(r => licenseLineFor(r.song)).join("\n\n")}${notice}`));
      downloadFile({ name: `${slugify(setlist.name)}-house-church.zip`, type: "application/zip", body: makeZip(files) });
    } finally {
      setPacking(false);
    }
  };
  const saveCopy = () => {
    const copy = createSetlist(setlist.name, setlist.items, { shareAlike: setlist.shareAlike });
    navigate(`/setlists/${copy.id}`);
  };
  const sub = (path: string) => (readOnly ? { pathname: `/setlists/shared/${path}`, hash: location.hash } : `/setlists/${setlist.id}/${path}`);

  return (
    <main className="wrap-narrow setlist-page">
      <p className="crumb" style={{ paddingTop: 32 }}><Link to="/setlists">{t("← Setlists")}</Link></p>
      <div className="setlist-head">
        {readOnly
          ? <><span className="eyebrow">{t("Shared setlist")}</span><h1 data-testid="setlist-title">{setlist.name}</h1></>
          : <input className="setlist-title" type="text" value={name} aria-label={t("Setlist name")} data-testid="setlist-title" onChange={e => setName(e.target.value)} onBlur={() => { if (name.trim() && name.trim() !== setlist.name) patch(s => ({ ...s, name: name.trim() })); else setName(setlist.name); }} />}
        <p className="hint" data-testid="setlist-meta">
          {t("{n} songs", { n: setlist.items.length })} · <span data-testid="setlist-duration">{duration.approx ? "≈ " : ""}{t("{n} min", { n: formatMinutes(duration.seconds) })}</span>
        </p>
      </div>

      <div className="setlist-actions" data-testid="setlist-actions">
        {readOnly && <button type="button" className="btn btn-primary" data-testid="save-copy" onClick={saveCopy}>{t("Save a copy")}</button>}
        <button type="button" className="btn btn-ghost" data-testid="share-link" onClick={share}>{copied === "link" ? t("Link copied ✓") : t("Share link")}</button>
        <button type="button" className="btn btn-ghost" data-testid="house-pack" disabled={!allLoaded || loaded.length === 0 || packing} onClick={pack}>{t("House-church pack")}</button>
        <button type="button" className="btn btn-ghost" data-testid="copy-chordpro" disabled={!allLoaded || loaded.length === 0} onClick={copyChordPro}>{copied === "chordpro" ? t("Copied ✓") : t("Copy for OnSong / Planning Center")}</button>
        <Link className="btn btn-ghost" to={sub("print")} data-testid="print-booklet">{t("Print booklet")}</Link>
        <Link className="btn btn-primary" to={sub("stage")} data-testid="stage-mode">{t("Stage mode")}</Link>
      </div>
      {copied === "link" && <input className="setlist-share-url" type="text" readOnly value={link} data-testid="share-url" onFocus={e => e.target.select()} />}
      <p className="hint">{t("The pack holds every song's chart in your key, lyrics, slides, and attribution, plus one LICENSE.txt. Band pack and FreeShow / OpenLP / B1 Serving exports follow the per-song exports.")}</p>

      {saSongs.length > 0 && (
        <div className="setlist-notice" data-testid="sa-notice">
          <p>
            {setlist.shareAlike
              ? t("This pack is share-alike: it carries {titles} under CC BY-SA, so anything you make from the pack keeps that license.", { titles: saSongs.map(s => s.title).join(", ") })
              : t("{titles} is CC BY-SA, so it stays out of the house-church pack unless the pack is marked share-alike. The chart, stage mode, and booklet still include it.", { titles: saSongs.map(s => s.title).join(", ") })}
          </p>
          <label><input type="checkbox" checked={!!setlist.shareAlike} disabled={readOnly} data-testid="share-alike" onChange={e => patch(s => ({ ...s, shareAlike: e.target.checked }))} /> {t("Share-alike pack (include CC BY-SA songs)")}</label>
        </div>
      )}

      {setlist.items.length === 0 && (
        <div className="card" style={{ padding: 32, textAlign: "center" }} data-testid="setlist-empty">
          <p style={{ marginBottom: 16 }}>{t("No songs yet. Open a song and press “+ Add to setlist”.")}</p>
          <Link to="/songs" className="btn btn-primary">{t("Explore the songs")}</Link>
        </div>
      )}
      <div className="setlist-items">
        {setlist.items.map((item, i) => (
          <ItemRow key={`${item.songId}-${i}`} item={item} index={i} count={setlist.items.length} song={songs.get(item.songId)} readOnly={readOnly}
            onChange={p => setItems(setlist.items.map((it, j) => (j === i ? { ...it, ...p } : it)))}
            onMove={to => setItems(move(setlist.items, i, to))}
            onRemove={() => setItems(setlist.items.filter((_, j) => j !== i))}
            onDrop={from => setItems(move(setlist.items, from, i))} />
        ))}
      </div>
      {!readOnly && setlist.items.length > 0 && <p className="hint"><Link to="/songs">{t("+ Add more songs")}</Link> · {t("Open a song and press “+ Add to setlist” — it joins the set in the key on screen.")}</p>}
    </main>
  );
}

/** Fullscreen chart view for a tablet on a music stand: one song per screen, arrows to move, screen kept awake. */
function Stage({ setlist, songs, exitTo }: { setlist: Setlist; songs: SongMap; exitTo: string | { pathname: string; hash: string } }) {
  const { t } = useI18n();
  const [i, setI] = useState(0);
  const [size, setSize] = useState(1.5);
  const [awake, setAwake] = useState(false);
  const n = setlist.items.length;
  usePageMeta(t("{name} — stage | WorshipCommons", { name: setlist.name }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", "PageDown", " "].includes(e.key)) { e.preventDefault(); setI(x => Math.min(n - 1, x + 1)); }
      if (["ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); setI(x => Math.max(0, x - 1)); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [n]);

  // keep-awake: the lock drops whenever the tab hides, so ask again each time it comes back
  useEffect(() => {
    let lock: { release: () => Promise<void>; addEventListener: (ev: string, fn: () => void) => void } | null = null;
    const request = async () => {
      try {
        lock = await (navigator as any).wakeLock?.request("screen");
        if (lock) { lock.addEventListener("release", () => setAwake(false)); setAwake(true); }
      } catch { setAwake(false); }
    };
    request();
    const onVisible = () => { if (document.visibilityState === "visible") request(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { document.removeEventListener("visibilitychange", onVisible); lock?.release().catch(() => {}); };
  }, []);

  useEffect(() => { window.scrollTo(0, 0); }, [i]);

  const item = setlist.items[i];
  const song = item ? songs.get(item.songId) : undefined;
  const next = setlist.items[i + 1] ? songs.get(setlist.items[i + 1].songId) : undefined;

  return (
    <main className="stage" data-testid="stage" style={{ fontSize: `${size}rem` }}>
      <header className="stage-bar no-print">
        <Link to={exitTo} className="stage-exit" data-testid="stage-exit">✕ {t("Exit")}</Link>
        <span className="stage-count" data-testid="stage-count">{i + 1} / {n}</span>
        <button type="button" aria-label={t("Previous song")} data-testid="stage-prev" disabled={i === 0} onClick={() => setI(i - 1)}>←</button>
        <button type="button" aria-label={t("Next song")} data-testid="stage-next" disabled={i >= n - 1} onClick={() => setI(i + 1)}>→</button>
        <button type="button" aria-label={t("Smaller text")} onClick={() => setSize(s => Math.max(1, s - 0.2))}>A−</button>
        <button type="button" aria-label={t("Larger text")} onClick={() => setSize(s => Math.min(3, s + 0.2))}>A+</button>
        <button type="button" data-testid="stage-fullscreen" onClick={() => (document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.())}>{t("Fullscreen")}</button>
        <span className={"stage-awake" + (awake ? " on" : "")} data-testid="wake-lock" data-awake={awake}>{awake ? t("● Keeping the screen awake") : t("○ Screen may sleep")}</span>
      </header>
      {!item && <p className="stage-empty">{t("No songs in this setlist.")}</p>}
      {item && song === undefined && <p className="stage-empty">{t("Loading…")}</p>}
      {item && song === null && <p className="stage-empty">{t("This song is no longer in the commons.")}</p>}
      {item && song && (
        <section className="stage-song" data-testid="stage-song" data-song={song.id}>
          <h1>{song.title}</h1>
          <p className="stage-meta">
            {t("Key of {key}", { key: chartShapes(song, item.key, item.capo).keyLabel })}
            {item.capo ? ` · ${t("Capo {n} — {root} shapes", { n: item.capo, root: chartShapes(song, item.key, item.capo).shapeLabel })}` : ""}
            {song.bpm ? ` · ${song.bpm} BPM` : ""}{item.arrangement ? ` · ${item.arrangement}` : ""}
          </p>
          <Chart song={song} item={item} />
        </section>
      )}
      {next && <footer className="stage-next" data-testid="stage-up-next">{t("Next: {title}", { title: next.title })} →</footer>}
    </main>
  );
}

/** Every chart in order, one per page, license line under each — the Sunday booklet. */
function Booklet({ setlist, songs, backTo }: { setlist: Setlist; songs: SongMap; backTo: string | { pathname: string; hash: string } }) {
  const { t } = useI18n();
  const [large, setLarge] = useState(false);
  const [chords, setChords] = useState(true);
  usePageMeta(t("{name} — booklet | WorshipCommons", { name: setlist.name }));
  return (
    <main className={"booklet" + (large ? " booklet-large" : "")} data-testid="booklet">
      <div className="no-print booklet-bar">
        <button type="button" onClick={() => window.print()}>{t("Print")}</button>
        <label><input type="checkbox" checked={large} data-testid="booklet-large" onChange={e => setLarge(e.target.checked)} /> {t("Large text")}</label>
        <label><input type="checkbox" checked={chords} data-testid="booklet-chords" onChange={e => setChords(e.target.checked)} /> {t("Show chords")}</label>
        <Link to={backTo}>{t("← Back to setlist")}</Link>
      </div>
      <section className="booklet-cover">
        <h1>{setlist.name}</h1>
        <ol>{setlist.items.map((it, i) => <li key={i}>{songs.get(it.songId)?.title || "…"} — {songs.get(it.songId) ? chartShapes(songs.get(it.songId)!, it.key, it.capo).keyLabel : it.key}</li>)}</ol>
      </section>
      {setlist.items.map((item, i) => {
        const song = songs.get(item.songId);
        if (!song) return <section className="booklet-song" key={i} data-testid="booklet-song"><p>{song === null ? t("This song is no longer in the commons.") : t("Loading…")}</p></section>;
        const { keyLabel, shapeLabel } = chartShapes(song, item.key, item.capo);
        return (
          <section className="booklet-song" key={i} data-testid="booklet-song" data-song={song.id}>
            <h2>{i + 1}. {song.title}</h2>
            <p className="booklet-meta">{song.writer} · {t("Key of {key}", { key: keyLabel })}{item.capo ? ` · ${t("Capo {n} — {root} shapes", { n: item.capo, root: shapeLabel })}` : ""}{song.bpm ? ` · ${song.bpm} BPM` : ""}{item.arrangement ? ` · ${item.arrangement}` : ""}</p>
            <Chart song={song} item={item} chords={chords} />
            {/* the registry notice: for CC songs the credit + license + link is a condition of the grant, so it prints on every chart */}
            <p className="booklet-license" data-testid="booklet-license">{licenseNotice(song)}</p>
          </section>
        );
      })}
    </main>
  );
}

export default function SetlistPage({ mode }: { mode: Mode }) {
  const { t } = useI18n();
  const { id } = useParams();
  const location = useLocation();
  const lists = useSetlists();
  const shared = mode === "shared" || id === "shared";
  const setlist = useMemo(() => (shared ? decodeShare(location.hash) : lists.find(s => s.id === id) || null), [shared, location.hash, lists, id]);
  const songs = useSongs(setlist?.items);

  if (!setlist) {
    return (
      <main className="wrap-narrow" data-testid="setlist-missing">
        <p className="crumb" style={{ padding: "60px 0" }}>{shared ? t("This share link is not a setlist.") : t("Setlist not found.")} <Link to="/setlists">{t("← Setlists")}</Link></p>
      </main>
    );
  }
  const back = shared ? { pathname: "/setlists/shared", hash: location.hash } : `/setlists/${setlist.id}`;
  if (mode === "stage") return <Stage setlist={setlist} songs={songs} exitTo={back} />;
  if (mode === "print") return <Booklet setlist={setlist} songs={songs} backTo={back} />;
  return <Editor setlist={setlist} songs={songs} readOnly={shared} />;
}
