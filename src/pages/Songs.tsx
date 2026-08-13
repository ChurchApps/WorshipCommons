import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { loadSongs, Song, themeList } from "../songs";
import { loadTune, TunePlayer } from "../midiPlayer";
import { coverSvg } from "../cover.mjs";
import "../styles/songs.css";
import { usePageMeta } from "../seo";
import { useI18n, SONG_LANG } from "../i18n";

const PAGE_SIZE = 50;
const tempoBucket = (bpm: number) => bpm <= 72 ? "slow" : bpm <= 100 ? "mid" : "fast";
const playableUrl = (s: Song) => s.demoAudioUrl || s.midiUrl;

interface Filters { q: string; themes: Set<string>; key: string; tempo: string; lang: string; lic: string; audio: boolean; mt: boolean; }

const XIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
);

const Chevron = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
);

const GlobeIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18" /></svg>
);

function FacetGroup({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="facet-group">
      <h3><button className="facet-head" aria-expanded={open} onClick={() => setOpen(!open)}>{title}<Chevron /></button></h3>
      {open && children}
    </div>
  );
}

export default function Songs() {
  const { t, lang } = useI18n();
  usePageMeta(t("Song library — WorshipCommons"), t("Search free worship songs by theme, scripture, key, tempo, or language. Chord charts and lyrics in any key, no licenses needed."));
  const [params] = useSearchParams();
  const [songs, setSongs] = useState<Song[]>([]);
  const [state, setState] = useState<Filters>(() => ({
    q: (params.get("q") || "").trim().toLowerCase(),
    themes: new Set(params.get("theme") ? [params.get("theme")] : []),
    key: "",
    tempo: "",
    lang: params.get("lang") || SONG_LANG[lang],
    lic: "",
    audio: false,
    mt: false
  }));
  const [sort, setSort] = useState("cong");
  const [page, setPage] = useState(1);
  // ponytail: sidebar starts open on desktop, closed on phones — one boolean, no resize listener
  const [facetsOpen, setFacetsOpen] = useState(() => window.innerWidth > 900);
  const [allThemes, setAllThemes] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tuneRef = useRef<TunePlayer | null>(null);
  const wantRef = useRef<string | null>(null);

  const stopAll = () => {
    audioRef.current?.pause();
    tuneRef.current?.stop();
    tuneRef.current = null;
    wantRef.current = null;
  };

  useEffect(() => { loadSongs().then(setSongs); }, []);
  useEffect(() => () => stopAll(), []);

  // "/" jumps to the search box, unless something else already has the keystroke
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key !== "/" || el?.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(el?.tagName || "")) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const update = (patch: Partial<Filters>) => { setState(s => ({ ...s, ...patch })); setPage(1); };

  const prevLang = useRef(lang);
  useEffect(() => {
    if (prevLang.current === lang) return;
    prevLang.current = lang;
    update({ lang: SONG_LANG[lang] });
  }, [lang]);

  const toggleTheme = (t: string, on: boolean) => {
    const themes = new Set(state.themes);
    if (on) themes.add(t); else themes.delete(t);
    update({ themes });
  };

  // "OR within a facet, AND across facets" — skip excludes a facet so its own counts stay live
  const matches = (s: Song, skip?: string) => {
    const th = themeList(s);
    const q = state.q.trim().toLowerCase();
    return (skip === "q" || !q || (s.title + " " + s.writer + " " + s.scripture + " " + s.themes).toLowerCase().includes(q)) &&
      (skip === "themes" || !state.themes.size || th.some(t => state.themes.has(t))) &&
      (skip === "key" || !state.key || s.songKey === state.key) &&
      (skip === "tempo" || !state.tempo || tempoBucket(s.bpm) === state.tempo) &&
      (skip === "lang" || !state.lang || s.language === state.lang) &&
      (skip === "lic" || !state.lic || s.license === state.lic) &&
      (skip === "audio" || !state.audio || !!s.demoAudioUrl) &&
      (skip === "mt" || !state.mt || !!s.stemsZipUrl);
  };

  const facets = useMemo(() => {
    const themeCounts: Record<string, number> = {};
    const langCounts: Record<string, number> = {};
    songs.forEach(s => {
      themeList(s).forEach(t => themeCounts[t] = (themeCounts[t] || 0) + 1);
      langCounts[s.language] = (langCounts[s.language] || 0) + 1;
    });
    return {
      themes: Object.entries(themeCounts).sort((a, b) => b[1] - a[1]).map(([t]) => t),
      keys: [...new Set(songs.map(s => s.songKey))].sort(),
      langs: Object.entries(langCounts).sort((a, b) => b[1] - a[1])
    };
  }, [songs]);

  const count = (skip: string, pred: (s: Song) => boolean) => songs.filter(s => matches(s, skip) && pred(s)).length;

  const list = useMemo(() => {
    const filtered = songs.filter(s => matches(s));
    // usage dominates, quality is a kicker; unscored songs sit at a neutral 50
    const maxCC = Math.max(1, ...songs.map(s => s.churchCount));
    const blend = (s: Song) => (s.churchCount / maxCC) * 60 + ((s.qualityScore ?? 50) / 100) * 40;
    filtered.sort((a, b) =>
      sort === "cong" ? blend(b) - blend(a) :
        sort === "new" ? b.year - a.year :
          a.title.localeCompare(b.title));
    return filtered;

  }, [songs, state, sort]);

  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const curPage = Math.min(page, pages);
  const start = (curPage - 1) * PAGE_SIZE;
  const slice = list.slice(start, start + PAGE_SIZE);

  // demo recording if there is one, otherwise the midi tune
  const togglePlay = async (s: Song) => {
    const wasPlaying = playingId === s.id;
    stopAll();
    setPlayingId(null);
    if (wasPlaying || !playableUrl(s)) return;
    setPlayingId(s.id);
    wantRef.current = s.id;
    if (s.demoAudioUrl) {
      const audio = new Audio(s.demoAudioUrl);
      audio.onended = () => setPlayingId(null);
      audio.play();
      audioRef.current = audio;
      return;
    }
    try {
      const p = await loadTune(s.midiUrl!);
      if (wantRef.current !== s.id) { p.stop(); return; }  // clicked elsewhere while loading
      tuneRef.current = p;
      p.onEnd = () => setPlayingId(null);
      p.play();
    } catch {
      if (wantRef.current === s.id) setPlayingId(null);
    }
  };

  const chips: { label: string; undo: () => void }[] = [];
  state.themes.forEach(th => chips.push({ label: th, undo: () => toggleTheme(th, false) }));
  if (state.key) chips.push({ label: t("Key of {key}", { key: state.key }), undo: () => update({ key: "" }) });
  if (state.tempo) chips.push({ label: t({ slow: "Slow", mid: "Moderate", fast: "Upbeat" }[state.tempo]), undo: () => update({ tempo: "" }) });
  if (state.lang) chips.push({ label: t(state.lang), undo: () => update({ lang: "" }) });
  if (state.lic) chips.push({ label: state.lic === "WC" ? t("Shared by writers") : t("Public domain"), undo: () => update({ lic: "" }) });
  if (state.audio) chips.push({ label: t("Has demo"), undo: () => update({ audio: false }) });
  if (state.mt) chips.push({ label: t("Has multitracks"), undo: () => update({ mt: false }) });

  const clearAll = () => update({ q: "", themes: new Set(), key: "", tempo: "", lang: "", lic: "", audio: false, mt: false });

  const pagerNums = useMemo(() => {
    const nums = [...new Set([1, 2, curPage - 1, curPage, curPage + 1, pages - 1, pages].filter(n => n >= 1 && n <= pages))].sort((a, b) => a - b);
    const out: (number | "gap")[] = [];
    let prev = 0;
    nums.forEach(n => { if (n - prev > 1) out.push("gap"); out.push(n); prev = n; });
    return out;
  }, [curPage, pages]);

  return (
    <main>
      <div className="cat-hero">
        <div className="wrap">
          <h1>{t("Find what your church will sing")}</h1>
          <p className="cat-sub">{t("Discover and license the best songs for your services.")}</p>
          <div className="search-bar" role="search">
            <div className="search-wrap">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
              <input ref={searchRef} type="text" id="q" value={state.q} onChange={e => update({ q: e.target.value })} placeholder={t("Search {count} songs by title, lyric, theme, scripture, or writer", { count: (songs.length || "").toLocaleString() })} aria-label={t("Search songs")} />
              <kbd aria-hidden="true">/</kbd>
            </div>
            <div className="search-sort">
              <select id="sort" aria-label={t("Sort by")} value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}>
                <option value="cong">{t("Most sung")}</option>
                <option value="new">{t("Newest")}</option>
                <option value="az">{t("Title A–Z")}</option>
              </select>
              <Chevron />
            </div>
            <button className="facet-toggle" aria-expanded={facetsOpen} onClick={() => setFacetsOpen(!facetsOpen)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M3 6h18M7 12h10M10 18h4" /></svg>
              {t("Filters")}
            </button>
          </div>
        </div>
      </div>

      <div className="wrap cat-layout">
        <aside className={"facets" + (facetsOpen ? " open" : "")} aria-label={t("Filter songs")}>
          <FacetGroup title={t("Theme")}>
            <ul className="facet-list">
              {(allThemes ? facets.themes : facets.themes.slice(0, 5)).map(th => (
                <li key={th}><label><input type="checkbox" checked={state.themes.has(th)} onChange={e => toggleTheme(th, e.target.checked)} /> {th} <span className="cnt">{count("themes", s => themeList(s).includes(th)).toLocaleString()}</span></label></li>
              ))}
            </ul>
            {facets.themes.length > 5 && (
              <button className="show-more" aria-expanded={allThemes} onClick={() => setAllThemes(!allThemes)}>
                {allThemes ? t("Show less") : t("Show more")}<Chevron size={13} />
              </button>
            )}
          </FacetGroup>
          <FacetGroup title={t("Key")}>
            <select value={state.key} onChange={e => update({ key: e.target.value })} aria-label={t("Key")}>
              <option value="">{t("Any key")}</option>
              {facets.keys.map(k => <option key={k}>{k}</option>)}
            </select>
          </FacetGroup>
          <FacetGroup title={t("Tempo")}>
            <ul className="facet-list">
              <li><label><input type="radio" name="tempo" checked={state.tempo === ""} onChange={() => update({ tempo: "" })} /> {t("Any tempo")}</label></li>
              <li><label><input type="radio" name="tempo" checked={state.tempo === "slow"} onChange={() => update({ tempo: "slow" })} /> {t("Slow · under 73")} <span className="cnt">{count("tempo", s => tempoBucket(s.bpm) === "slow").toLocaleString()}</span></label></li>
              <li><label><input type="radio" name="tempo" checked={state.tempo === "mid"} onChange={() => update({ tempo: "mid" })} /> {t("Moderate · 73–100")} <span className="cnt">{count("tempo", s => tempoBucket(s.bpm) === "mid").toLocaleString()}</span></label></li>
              <li><label><input type="radio" name="tempo" checked={state.tempo === "fast"} onChange={() => update({ tempo: "fast" })} /> {t("Upbeat · 100+")} <span className="cnt">{count("tempo", s => tempoBucket(s.bpm) === "fast").toLocaleString()}</span></label></li>
            </ul>
          </FacetGroup>
          <FacetGroup title={t("Language")}>
            <select value={state.lang} onChange={e => update({ lang: e.target.value })} aria-label={t("Language")}>
              <option value="">{t("Any language")}</option>
              {facets.langs.map(([l, n]) => <option key={l} value={l}>{`${t(l)} (${n.toLocaleString()})`}</option>)}
            </select>
          </FacetGroup>
          <FacetGroup title={t("Source")}>
            <ul className="facet-list">
              <li><label><input type="radio" name="lic" checked={state.lic === ""} onChange={() => update({ lic: "" })} /> {t("All songs")}</label></li>
              <li><label><input type="radio" name="lic" checked={state.lic === "WC"} onChange={() => update({ lic: "WC" })} /> {t("Shared by writers")} <span className="cnt">{count("lic", s => s.license === "WC").toLocaleString()}</span></label></li>
              <li><label><input type="radio" name="lic" checked={state.lic === "PD"} onChange={() => update({ lic: "PD" })} /> {t("Public domain")} <span className="cnt">{count("lic", s => s.license === "PD").toLocaleString()}</span></label></li>
            </ul>
          </FacetGroup>
          <FacetGroup title={t("Extras")}>
            <ul className="facet-list">
              <li><label><input type="checkbox" checked={state.audio} onChange={e => update({ audio: e.target.checked })} /> {t("Has demo recording")}</label></li>
              <li><label><input type="checkbox" checked={state.mt} onChange={e => update({ mt: e.target.checked })} /> {t("Has multitracks")} <span className="cnt">{count("mt", s => !!s.stemsZipUrl).toLocaleString()}</span></label></li>
            </ul>
          </FacetGroup>
        </aside>

        <section aria-label={t("Results")}>
          <div className="results-head">
            {/* numbers only — no user content in the interpolated values */}
            <span className="count" id="count" dangerouslySetInnerHTML={{
              __html: list.length
                ? t("Showing <b>{from}–{to}</b> of <b>{total}</b> songs", { from: (start + 1).toLocaleString(), to: (start + slice.length).toLocaleString(), total: list.length.toLocaleString() })
                : t("No songs found")
            }} />
            <span id="active-chips">
              {chips.map(c => (
                <button key={c.label} className="active-chip" onClick={c.undo}>{c.label} <XIcon /></button>
              ))}
            </span>
            {chips.length > 0 && <button className="clear-all" onClick={clearAll}>{t("Clear all filters")}</button>}
          </div>

          {list.length > 0 && (
            <div className="table" id="table">
              <div className="thead">
                <span></span><span></span><span>{t("Song")}</span><span>{t("Themes")}</span><span className="c">{t("Key")}</span><span className="c">{t("BPM")}</span><span className="c">{t("Used by")}</span><span>{t("Source")}</span>
              </div>
              <div>
                {slice.map(s => (
                  <div className="t-row" key={s.id}>
                    <button className={"play-btn" + (playableUrl(s) ? "" : " mute")} aria-label={playableUrl(s) ? t(playingId === s.id ? "Pause {title}" : "Play {title}", { title: s.title }) : t("No demo yet")} onClick={() => togglePlay(s)}>
                      {playingId === s.id
                        ? <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
                        : <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>}
                    </button>
                    {s.artUrl || s.writerPortraitUrl
                      ? <Link to={`/songs/${s.id}`} className="t-cover" tabIndex={-1} aria-hidden="true"><img className={s.artUrl ? "art" : ""} src={s.artUrl || s.writerPortraitUrl} alt="" loading="lazy" /></Link>
                      : <Link to={`/songs/${s.id}`} className="t-cover" tabIndex={-1} aria-hidden="true" dangerouslySetInnerHTML={{ __html: coverSvg(s, 96, 96) }} />}
                    <div className="t-main"><Link to={`/songs/${s.id}`}>{s.title}</Link><span>{s.writer} • {s.year}{s.stemsZipUrl ? <> • <b className="mt-flag">stems</b></> : null}</span></div>
                    <span className="t-themes">{themeList(s).slice(0, 3).map(th => <span className="th" key={th}>{th}</span>)}</span>
                    <span className="t-num t-key c">{s.songKey}</span>
                    <span className="t-num t-bpm c">{s.bpm}</span>
                    <span className="t-num t-cong c">{s.churchCount.toLocaleString()}</span>
                    <span className="t-badge">{s.license === "WC" ? <span className="free-badge">{t("Free")}</span> : <span className="pd-badge"><GlobeIcon />{t("Public domain")}</span>}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {list.length === 0 && songs.length > 0 && (
            <div className="empty">
              <h3>{t("Nothing matches yet")}</h3>
              <p>{t("Loosen a filter — or")} <Link to="/upload">{t("share the song the commons is missing")}</Link>.</p>
            </div>
          )}

          {pages > 1 && (
            <nav className="pager" aria-label={t("Pagination")}>
              <button disabled={curPage === 1} onClick={() => { setPage(curPage - 1); window.scrollTo({ top: 0 }); }}>‹</button>
              {pagerNums.map((n, i) => n === "gap"
                ? <span key={"g" + i} className="gap">…</span>
                : <button key={n} className={n === curPage ? "cur" : ""} onClick={() => { setPage(n); window.scrollTo({ top: 0 }); }}>{n.toLocaleString()}</button>)}
              <button disabled={curPage === pages} onClick={() => { setPage(curPage + 1); window.scrollTo({ top: 0 }); }}>›</button>
            </nav>
          )}
        </section>
      </div>
    </main>
  );
}
