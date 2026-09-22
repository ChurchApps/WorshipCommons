import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { loadSong, Song, songPath } from "../songs";
import {
  chordProFor, createSetlist, decodeShare, defaultOrder, durationSeconds, formatMinutes, isShareAlike, keyChoices,
  licenseLineFor, packFilesFor, sectionLabels, shareUrl, transposedSections, updateSetlist, useSetlists, type Setlist, type SetlistItem
} from "../setlists";
import { chartShapes } from "../chordpro";
import { licenseNotice } from "../licenses";
import { makeZip, textEntry } from "../zip";
import { downloadFile, exportFreeShow, exportOpenLyrics, exportPptx, exportProPresenter, slug, type ExportFile, type ExportItem } from "../exports";
import { usePageMeta } from "../seo";
import { useI18n } from "../i18n";
import { EmptyState } from "../components/EmptyState";
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

interface ChartProps {
  song: Song;
  item: SetlistItem;
  chords?: boolean;
}

/** One chart, chords over the words, in the key and capo the setlist chose. */
const Chart: React.FC<ChartProps> = (props) => {
  const chords = props.chords ?? true;
  const sections = useMemo(() => transposedSections(props.song, props.item.key, props.item.capo, props.item.order), [props.song, props.item.key, props.item.capo, props.item.order]);
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
};

function move<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length || from === to) return arr;
  const next = arr.slice();
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}

interface ItemRowProps {
  item: SetlistItem;
  index: number;
  count: number;
  song: Song | null | undefined;
  readOnly: boolean;
  onChange: (patch: Partial<SetlistItem>) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
  onDrop: (from: number) => void;
}

const ItemRow: React.FC<ItemRowProps> = (props) => {
  const { t } = useI18n();
  const song = props.song;
  if (song === null) {
    return (
      <div className="card setlist-item setlist-item-gone" data-testid="setlist-item" data-song={props.item.songId}>
        <p>{t("This song is no longer in the commons.")}</p>
        {!props.readOnly && <button type="button" className="chip" data-testid="item-remove" onClick={props.onRemove}>{t("Remove")}</button>}
      </div>
    );
  }
  if (!song) return <div className="card setlist-item" data-testid="setlist-item" data-song={props.item.songId}><p className="hint">{t("Loading…")}</p></div>;

  const keys = keyChoices(song);
  const picks = props.item.order ?? defaultOrder(song);
  const labels = sectionLabels(song);
  const { keyLabel, shapeLabel } = chartShapes(song, props.item.key, props.item.capo);
  const setPicks = (order: string[]) => props.onChange({ order });

  return (
    <div className="card setlist-item" data-testid="setlist-item" data-song={song.id} draggable={!props.readOnly}
      onDragStart={e => { e.dataTransfer.setData("text/plain", String(props.index)); e.dataTransfer.effectAllowed = "move"; }}
      onDragOver={e => { if (!props.readOnly) e.preventDefault(); }}
      onDrop={e => { e.preventDefault(); const from = Number(e.dataTransfer.getData("text/plain")); if (!Number.isNaN(from)) props.onDrop(from); }}>
      <div className="setlist-item-head">
        <span className="setlist-index" aria-hidden="true">{props.index + 1}</span>
        <div className="setlist-item-title">
          <h3><Link to={`${songPath(song)}?key=${encodeURIComponent(keyLabel)}`} data-testid="item-title">{song.title}</Link></h3>
          <p className="hint">{song.writer}{song.year ? ` · ${song.year}` : ""}{isShareAlike(song) ? ` · ${t("CC BY-SA")}` : ""}</p>
        </div>
        {!props.readOnly && (
          <div className="setlist-item-move">
            <button type="button" className="chip" aria-label={t("Move up")} data-testid="move-up" disabled={props.index === 0} onClick={() => props.onMove(props.index - 1)}>↑</button>
            <button type="button" className="chip" aria-label={t("Move down")} data-testid="move-down" disabled={props.index === props.count - 1} onClick={() => props.onMove(props.index + 1)}>↓</button>
            <button type="button" className="chip" data-testid="item-remove" onClick={props.onRemove}>{t("Remove")}</button>
          </div>
        )}
      </div>

      {props.readOnly
        ? (
          <p className="setlist-item-summary" data-testid="item-summary">
            {t("Key of {key}", { key: keyLabel })}{props.item.capo ? ` · ${t("Capo {n} — {root} shapes", { n: props.item.capo, root: shapeLabel })}` : ""} · {picks.join(" → ")}{props.item.arrangement ? ` · ${props.item.arrangement}` : ""}
          </p>
        )
        : (
          <div className="setlist-item-controls">
            <label>{t("Key")}
              <select value={props.item.key || song.songKey} data-testid="item-key" onChange={e => props.onChange({ key: e.target.value })}>
                <optgroup label={t("Published")}>{keys.published.map(k => <option key={k} value={k}>{k}</option>)}</optgroup>
                <optgroup label={t("Preview (any key)")}>{keys.preview.map(k => <option key={k} value={k}>{k}</option>)}</optgroup>
              </select>
            </label>
            <label>{t("Capo")}
              <select value={props.item.capo} data-testid="item-capo" onChange={e => props.onChange({ capo: Number(e.target.value) })}>
                <option value={0}>{t("None")}</option>
                {[1, 2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>{t("{n} — {root} shapes", { n, root: chartShapes(song, props.item.key, n).shapeLabel })}</option>)}
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
                {props.item.order && <button type="button" className="chip" data-testid="pick-reset" onClick={() => props.onChange({ order: undefined })}>{t("Reset to default")}</button>}
              </div>
            </div>
            <label className="setlist-arrangement">{t("Arrangement")}
              <input type="text" value={props.item.arrangement || ""} placeholder={t("Chorus ×2 at the end, last verse a cappella…")} data-testid="item-note" onChange={e => props.onChange({ arrangement: e.target.value })} />
            </label>
          </div>
        )}
    </div>
  );
};

interface EditorProps {
  setlist: Setlist;
  songs: SongMap;
  readOnly: boolean;
}

const Editor: React.FC<EditorProps> = (props) => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [copied, setCopied] = useState<"" | "link" | "chordpro">("");
  const [name, setName] = useState(props.setlist.name);
  const [packing, setPacking] = useState(false);
  useEffect(() => setName(props.setlist.name), [props.setlist.name]);
  usePageMeta(t("{name} — service plan | WorshipCommons", { name: props.setlist.name }));

  const loaded = props.setlist.items.map(i => props.songs.get(i.songId)).filter((s): s is Song => !!s);
  const allLoaded = props.setlist.items.every(i => props.songs.has(i.songId));
  const duration = durationSeconds(props.setlist.items, loaded);
  const saSongs = loaded.filter(isShareAlike);
  const patch = (change: (s: Setlist) => Setlist) => { if (!props.readOnly) updateSetlist(props.setlist.id, change); };
  const setItems = (items: SetlistItem[]) => patch(s => ({ ...s, items }));
  const flash = (what: "link" | "chordpro") => { setCopied(what); setTimeout(() => setCopied(""), 2500); };

  const link = shareUrl(props.setlist);
  const handleShare = async () => {
    try { await navigator.clipboard.writeText(link); } catch { /* the field below stays selectable */ }
    flash("link");
  };
  const handleCopyChordPro = async () => {
    const text = props.setlist.items.map(i => { const s = props.songs.get(i.songId); return s ? chordProFor(s, i.key, i.capo, i.order) : ""; }).filter(Boolean).join("\n");
    try { await navigator.clipboard.writeText(text); } catch { /* blocked clipboard: nothing else to do */ }
    flash("chordpro");
  };
  const handlePack = () => {
    if (packing) return;
    setPacking(true);
    try {
      // CC BY-SA rule: a share-alike song makes the compiled pack share-alike, so it stays out unless the set says so
      const rows = props.setlist.items.map(i => ({ item: i, song: props.songs.get(i.songId) })).filter((r): r is { item: SetlistItem; song: Song } => !!r.song && (props.setlist.shareAlike || !isShareAlike(r.song)));
      const files = rows.flatMap((r, i) => packFilesFor(r.song, r.item, `${String(i + 1).padStart(2, "0")}-${slug(r.song.title)}`).map(f => textEntry(f.name, f.text)));
      const order = rows.map((r, i) => `${i + 1}. ${r.song.title} — ${chartShapes(r.song, r.item.key, r.item.capo).keyLabel}${r.item.capo ? ` (capo ${r.item.capo})` : ""}${r.item.arrangement ? ` — ${r.item.arrangement}` : ""}`);
      files.push(textEntry("setlist.txt", `${props.setlist.name}\n\n${order.join("\n")}\n`));
      const notice = props.setlist.shareAlike && rows.some(r => isShareAlike(r.song)) ? "\n\nThis pack includes CC BY-SA songs. Share the pack, or anything you make from it, under the same license.\n" : "\n";
      files.push(textEntry("LICENSE.txt", `${props.setlist.name}\n\n${rows.map(r => licenseLineFor(r.song)).join("\n\n")}${notice}`));
      downloadFile({ name: `${slug(props.setlist.name)}-house-church.zip`, type: "application/zip", body: makeZip(files) });
    } finally {
      setPacking(false);
    }
  };
  /** The whole set for projection software: every loaded song in set order, in the key and sections the set chose. */
  const handleProject = (write: (items: ExportItem[]) => ExportFile) => {
    const file = write(props.setlist.items.flatMap(i => { const song = props.songs.get(i.songId); return song ? [{ song, key: i.key, order: i.order }] : []; }));
    downloadFile({ ...file, name: `${slug(props.setlist.name)}-${file.name}` });
  };
  const handleSaveCopy = () => {
    const copy = createSetlist(props.setlist.name, props.setlist.items, { shareAlike: props.setlist.shareAlike });
    navigate(`/setlists/${copy.id}`);
  };
  const sub = (path: string) => (props.readOnly ? { pathname: `/setlists/shared/${path}`, hash: location.hash } : `/setlists/${props.setlist.id}/${path}`);

  return (
    <main className="wrap-narrow setlist-page">
      <p className="crumb" style={{ paddingTop: 32 }}><Link to="/setlists">{t("← Service plans")}</Link></p>
      <div className="setlist-head">
        {props.readOnly
          ? <><span className="eyebrow">{t("Shared service plan")}</span><h1 data-testid="setlist-title">{props.setlist.name}</h1></>
          : <input className="setlist-title" type="text" value={name} aria-label={t("Service plan name")} data-testid="setlist-title" onChange={e => setName(e.target.value)} onBlur={() => { if (name.trim() && name.trim() !== props.setlist.name) patch(s => ({ ...s, name: name.trim() })); else setName(props.setlist.name); }} />}
        <p className="hint" data-testid="setlist-meta">
          {t("{n} songs", { n: props.setlist.items.length })} · <span data-testid="setlist-duration">{duration.approx ? "≈ " : ""}{t("{n} min", { n: formatMinutes(duration.seconds) })}</span>
        </p>
      </div>

      <div className="setlist-actions" data-testid="setlist-actions">
        {props.readOnly && <button type="button" className="btn btn-primary" data-testid="save-copy" onClick={handleSaveCopy}>{t("Save a copy")}</button>}
        <button type="button" className="btn btn-ghost" data-testid="share-link" onClick={handleShare}>{copied === "link" ? t("Link copied ✓") : t("Share link")}</button>
        <button type="button" className="btn btn-ghost" data-testid="house-pack" disabled={!allLoaded || loaded.length === 0 || packing} onClick={handlePack}>{t("House-church pack")}</button>
        <button type="button" className="btn btn-ghost" data-testid="copy-chordpro" disabled={!allLoaded || loaded.length === 0} onClick={handleCopyChordPro}>{copied === "chordpro" ? t("Copied ✓") : t("Copy for OnSong / Planning Center")}</button>
        <Link className="btn btn-ghost" to={sub("print")} data-testid="print-booklet">{t("Print booklet")}</Link>
        <Link className="btn btn-primary" to={sub("stage")} data-testid="stage-mode">{t("Stage mode")}</Link>
      </div>
      {copied === "link" && <input className="setlist-share-url" type="text" readOnly value={link} data-testid="share-url" onFocus={e => e.target.select()} />}
      <p className="hint">{t("The pack holds every song's chart in your key, lyrics, slides, and attribution, plus one LICENSE.txt.")}</p>
      <div className="setlist-actions" data-testid="setlist-exports">
        <button type="button" className="btn btn-ghost" data-testid="set-export-freeshow" title={t("Download for FreeShow")} disabled={!allLoaded || loaded.length === 0} onClick={() => handleProject(exportFreeShow)}>FreeShow</button>
        <button type="button" className="btn btn-ghost" data-testid="set-export-openlyrics" title={t("Download OpenLyrics (OpenLP)")} disabled={!allLoaded || loaded.length === 0} onClick={() => handleProject(exportOpenLyrics)}>OpenLP</button>
        <button type="button" className="btn btn-ghost" data-testid="set-export-propresenter" title={t("Download for ProPresenter")} disabled={!allLoaded || loaded.length === 0} onClick={() => handleProject(exportProPresenter)}>ProPresenter</button>
        <button type="button" className="btn btn-ghost" data-testid="set-export-pptx" title={t("Download PPTX")} disabled={!allLoaded || loaded.length === 0} onClick={() => handleProject(exportPptx)}>PowerPoint</button>
      </div>

      {saSongs.length > 0 && (
        <div className="setlist-notice" data-testid="sa-notice">
          <p>
            {props.setlist.shareAlike
              ? t("This pack is share-alike: it carries {titles} under CC BY-SA, so anything you make from the pack keeps that license.", { titles: saSongs.map(s => s.title).join(", ") })
              : t("{titles} is CC BY-SA, so it stays out of the house-church pack unless the pack is marked share-alike. The chart, stage mode, and booklet still include it.", { titles: saSongs.map(s => s.title).join(", ") })}
          </p>
          <label><input type="checkbox" checked={!!props.setlist.shareAlike} disabled={props.readOnly} data-testid="share-alike" onChange={e => patch(s => ({ ...s, shareAlike: e.target.checked }))} /> {t("Share-alike pack (include CC BY-SA songs)")}</label>
        </div>
      )}

      {props.setlist.items.length === 0 && (
        <EmptyState testId="setlist-empty" message={t("No songs yet. Open a song and press “+ Add to service plan”.")} to="/songs" action={t("Explore the songs")} />
      )}
      <div className="setlist-items">
        {props.setlist.items.map((item, i) => (
          <ItemRow key={`${item.songId}-${i}`} item={item} index={i} count={props.setlist.items.length} song={props.songs.get(item.songId)} readOnly={props.readOnly}
            onChange={p => setItems(props.setlist.items.map((it, j) => (j === i ? { ...it, ...p } : it)))}
            onMove={to => setItems(move(props.setlist.items, i, to))}
            onRemove={() => setItems(props.setlist.items.filter((_, j) => j !== i))}
            onDrop={from => setItems(move(props.setlist.items, from, i))} />
        ))}
      </div>
      {!props.readOnly && props.setlist.items.length > 0 && <p className="hint"><Link to="/songs">{t("+ Add more songs")}</Link> · {t("Open a song and press “+ Add to service plan” — it joins the set in the key on screen.")}</p>}
    </main>
  );
};

interface StageProps {
  setlist: Setlist;
  songs: SongMap;
  exitTo: string | { pathname: string; hash: string };
}

/** Fullscreen chart view for a tablet on a music stand: one song per screen, arrows to move, screen kept awake. */
const Stage: React.FC<StageProps> = (props) => {
  const { t } = useI18n();
  const [i, setI] = useState(0);
  const [size, setSize] = useState(1.5);
  const [awake, setAwake] = useState(false);
  const n = props.setlist.items.length;
  usePageMeta(t("{name} — stage | WorshipCommons", { name: props.setlist.name }));

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

  const item = props.setlist.items[i];
  const song = item ? props.songs.get(item.songId) : undefined;
  const next = props.setlist.items[i + 1] ? props.songs.get(props.setlist.items[i + 1].songId) : undefined;

  return (
    <main className="stage" data-testid="stage" style={{ fontSize: `${size}rem` }}>
      <header className="stage-bar no-print">
        <Link to={props.exitTo} className="stage-exit" data-testid="stage-exit">✕ {t("Exit")}</Link>
        <span className="stage-count" data-testid="stage-count">{i + 1} / {n}</span>
        <button type="button" aria-label={t("Previous song")} data-testid="stage-prev" disabled={i === 0} onClick={() => setI(i - 1)}>←</button>
        <button type="button" aria-label={t("Next song")} data-testid="stage-next" disabled={i >= n - 1} onClick={() => setI(i + 1)}>→</button>
        <button type="button" aria-label={t("Smaller text")} onClick={() => setSize(s => Math.max(1, s - 0.2))}>A−</button>
        <button type="button" aria-label={t("Larger text")} onClick={() => setSize(s => Math.min(3, s + 0.2))}>A+</button>
        <button type="button" data-testid="stage-fullscreen" onClick={() => (document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.())}>{t("Fullscreen")}</button>
        <span className={"stage-awake" + (awake ? " on" : "")} data-testid="wake-lock" data-awake={awake}>{awake ? t("● Keeping the screen awake") : t("○ Screen may sleep")}</span>
      </header>
      {!item && <p className="stage-empty">{t("No songs in this service plan.")}</p>}
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
};

interface BookletProps {
  setlist: Setlist;
  songs: SongMap;
  backTo: string | { pathname: string; hash: string };
}

/** Every chart in order, one per page, license line under each — the Sunday booklet. */
const Booklet: React.FC<BookletProps> = (props) => {
  const { t } = useI18n();
  const [large, setLarge] = useState(false);
  const [chords, setChords] = useState(true);
  usePageMeta(t("{name} — booklet | WorshipCommons", { name: props.setlist.name }));
  return (
    <main className={"booklet" + (large ? " booklet-large" : "")} data-testid="booklet">
      <div className="no-print booklet-bar">
        <button type="button" onClick={() => window.print()}>{t("Print")}</button>
        <label><input type="checkbox" checked={large} data-testid="booklet-large" onChange={e => setLarge(e.target.checked)} /> {t("Large text")}</label>
        <label><input type="checkbox" checked={chords} data-testid="booklet-chords" onChange={e => setChords(e.target.checked)} /> {t("Show chords")}</label>
        <Link to={props.backTo}>{t("← Back to service plan")}</Link>
      </div>
      <section className="booklet-cover">
        <h1>{props.setlist.name}</h1>
        <ol>{props.setlist.items.map((it, i) => <li key={i}>{props.songs.get(it.songId)?.title || "…"} — {props.songs.get(it.songId) ? chartShapes(props.songs.get(it.songId)!, it.key, it.capo).keyLabel : it.key}</li>)}</ol>
      </section>
      {props.setlist.items.map((item, i) => {
        const song = props.songs.get(item.songId);
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
};

interface Props {
  mode: Mode;
}

export const SetlistPage: React.FC<Props> = (props) => {
  const { t } = useI18n();
  const { id } = useParams();
  const location = useLocation();
  const lists = useSetlists();
  const shared = props.mode === "shared" || id === "shared";
  const setlist = useMemo(() => (shared ? decodeShare(location.hash) : lists.find(s => s.id === id) || null), [shared, location.hash, lists, id]);
  const songs = useSongs(setlist?.items);

  if (!setlist) {
    return (
      <main className="wrap-narrow" data-testid="setlist-missing">
        <p className="crumb" style={{ padding: "60px 0" }}>{shared ? t("This share link is not a service plan.") : t("Service plan not found.")} <Link to="/setlists">{t("← Service plans")}</Link></p>
      </main>
    );
  }
  const back = shared ? { pathname: "/setlists/shared", hash: location.hash } : `/setlists/${setlist.id}`;
  if (props.mode === "stage") return <Stage setlist={setlist} songs={songs} exitTo={back} />;
  if (props.mode === "print") return <Booklet setlist={setlist} songs={songs} backTo={back} />;
  return <Editor setlist={setlist} songs={songs} readOnly={shared} />;
};
