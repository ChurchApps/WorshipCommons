import React, { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { coverOf, kindOf, loadSongs, recordingUrlOf, Song, songPath } from "../songs";
import { coverSvg } from "../cover.mjs";
import { loadTune, TunePlayer } from "../midiPlayer";
import { libraryIds, setInLibrary } from "../library";
import { useAuth } from "../auth";
import "../styles/home.css";
import { usePageMeta } from "../seo";
import { useI18n, SONG_LANG } from "../i18n";
import { topBlock } from "../catalog";

const PlayIcon: React.FC = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>;
const StopIcon: React.FC = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2" /></svg>;

interface SaveIconProps {
  on: boolean;
}

const SaveIcon: React.FC<SaveIconProps> = (props) => <svg width="14" height="14" viewBox="0 0 24 24" fill={props.on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 4h12v16l-6-4-6 4z" /></svg>;
const SearchIcon: React.FC = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>;

// the chips deep-link into the library: theme, license, readiness, and recency are all real /songs filters
const CHIPS: [string, string][] = [
  ["All Songs", "/songs"],
  ["Start here", "/songs?start=1"],
  ["Timeless Hymns", "/songs?license=PD"],
  ["Modern Worship", "/songs?era=modern"],
  ["Acoustic", "/songs?guitar=1"],
  ["New Releases", "/songs?sort=new"]
];

export const Home: React.FC = () => {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  usePageMeta(t("WorshipCommons — Great music. For every church."), t("Discover worship songs, timeless hymns, and the resources to lead them. All freely shared with the Church."));
  const [songs, setSongs] = useState<Song[]>([]);
  const [catalogStatus, setCatalogStatus] = useState<"loading" | "ready" | "error">("loading");
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [saved, setSaved] = useState<string[]>([]);
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tuneRef = useRef<TunePlayer | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    let live = true;
    loadSongs().then(rows => {
      if (!live) return;
      setSongs(rows);
      setCatalogStatus("ready");
    }).catch(() => { if (live) setCatalogStatus("error"); });
    return () => { live = false; };
  }, [catalogAttempt]);
  useEffect(() => { if (user) libraryIds().then(setSaved); else setSaved([]); }, [user]);
  const stopAll = () => { audioRef.current?.pause(); tuneRef.current?.stop(); tuneRef.current = null; setPlaying(null); };
  useEffect(() => () => { audioRef.current?.pause(); tuneRef.current?.stop(); }, []);

  const block = topBlock(songs, SONG_LANG[lang]);
  const startHere = block.heading === "Start here";
  // real recordings first (stable sort keeps rank order within each group), so the play button isn't all synth piano
  const set = [...block.songs].sort((a, b) => +!!recordingUrlOf(b) - +!!recordingUrlOf(a)).slice(0, 4);
  const langCount = new Set(songs.map(s => s.language).filter(Boolean)).size;

  // demo recording if there is one, otherwise the melody file through the piano soundfont
  const handleTogglePlay = async (s: Song) => {
    const was = playing === s.id;
    stopAll();
    const rec = recordingUrlOf(s);
    if (was || !(rec || s.midiUrl)) return;
    setPlaying(s.id);
    if (rec) {
      const a = new Audio(rec);
      a.onended = () => setPlaying(null);
      a.play();
      audioRef.current = a;
      return;
    }
    try {
      const p = await loadTune(s.midiUrl!);
      tuneRef.current = p;
      p.onEnd = () => setPlaying(null);
      p.play();
    } catch { setPlaying(null); }
  };

  const handleToggleSave = async (s: Song) => {
    if (!user) { navigate(`/login?next=${encodeURIComponent(location.pathname)}`); return; }
    const on = saved.includes(s.id);
    await setInLibrary(s.id, !on);
    setSaved(on ? saved.filter(id => id !== s.id) : [...saved, s.id]);
  };

  const handleSearch = (e: FormEvent) => { e.preventDefault(); navigate(q.trim() ? `/songs?q=${encodeURIComponent(q.trim())}` : "/songs"); };

  return (
    <main>
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <p className="eyebrow rise">{t("Freely given. Freely shared.")}</p>
            <h1 className="rise">{t("Great music.")}<br /><em>{t("For every church.")}</em></h1>
            <p className="lede rise rise-2">{t("Discover worship songs, timeless hymns, and the resources to lead them. All freely shared with the Church.")}</p>
            <div className="hero-ctas rise rise-2">
              <Link to="/songs" className="btn btn-primary btn-lg">{t("Find your next song →")}</Link>
              <Link to="/mission" className="btn btn-ghost btn-lg">{t("Our Mission")}</Link>
            </div>
            <p className="hero-proof rise rise-3">
              {catalogStatus === "error" ? (
                <span data-testid="catalog-error">{t("The song library didn't load.")} <button type="button" className="text-retry" data-testid="catalog-retry" onClick={() => setCatalogAttempt(n => n + 1)}>{t("Try again")}</button></span>
              ) : catalogStatus === "loading" ? (
                <span>{t("Loading…")}</span>
              ) : (
                <>
                  <span><strong>{t("{count} songs", { count: songs.length.toLocaleString() })}</strong> {t("free for your church to use")}</span>
                  <span><strong data-testid="home-langs">{t("{count} languages", { count: langCount })}</strong></span>
                </>
              )}
            </p>
          </div>
          <div className="hero-photo rise rise-3">
            <img src="/mock/hero-band.jpg" alt={t("A worship band rehearsing: singer, guitar, and keys in a sunlit loft")} />
          </div>
        </div>
      </section>

      <div className="wrap">
        <form className="search-row" onSubmit={handleSearch} role="search">
          <label className="field">
            <SearchIcon />
            <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={t("Search songs, lyrics, scripture, or themes…")} aria-label={t("Search songs")} />
          </label>
          <button className="btn btn-primary" type="submit">{t("Search")}</button>
        </form>
        <div className="chips">
          {CHIPS.map(([label, to], i) => <Link key={label} className={"chip" + (i === 0 ? " on" : "")} to={to} {...(label === "Start here" ? { "data-testid": "start-here-chip" } : {})}>{t(label)}</Link>)}
          <Link className="chip" to="/songs?theme=Kids" data-testid="kids-chip">{t("Kids & VBS")}</Link>
        </div>

        <div className="sec-head">
          <div>
            <p className="kicker" data-testid="home-top-heading">{t(block.heading)}</p>
            <h2>{t("Find your next Sunday set.")}</h2>
            <p>{t(startHere ? "Forty hymns with a score and a chart." : "Songs worth singing. Resources ready to go.")}</p>
          </div>
          <Link className="more" data-testid="home-top-more" to={block.heading === "Sunday-ready" ? "/songs?confidence=sunday-ready" : startHere ? "/songs?start=1" : "/songs"}>{t(startHere ? "See all 40 →" : "Explore all songs →")}</Link>
        </div>

        <ul className="albums" data-testid="home-top-list">
          {set.map(s => {
            const cover = coverOf(s);
            const isSaved = saved.includes(s.id);
            return (
              <li key={s.id} className="album">
                <div className="album-art">
                  <Link to={songPath(s)} aria-label={s.title}>
                    {cover
                      ? <img className={cover.portrait ? "portrait" : "art"} src={cover.src} alt="" loading="lazy" />
                      : <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: coverSvg(s, 400, 400) }} />}
                    {!(cover?.portrait) && <span className="album-title" aria-hidden="true">{s.title}</span>}
                  </Link>
                  {(recordingUrlOf(s) || s.midiUrl) && (
                    <button className="play" type="button" aria-label={t(playing === s.id ? "Stop {title}" : "Play {title}", { title: s.title })} onClick={() => handleTogglePlay(s)}>
                      {playing === s.id ? <StopIcon /> : <PlayIcon />}
                    </button>
                  )}
                  <button className={"save" + (isSaved ? " on" : "")} type="button" aria-pressed={isSaved} aria-label={t(isSaved ? "Remove {title} from saved songs" : "Save {title}", { title: s.title })} onClick={() => handleToggleSave(s)}>
                    <SaveIcon on={isSaved} />
                  </button>
                </div>
                <h3><Link to={songPath(s)} className="album">{s.title}</Link></h3>
                <p className="kind">{t(kindOf(s))}</p>
              </li>
            );
          })}
        </ul>

        <section className="lead-block">
          <div className="lead-block-photo">
            <img src="/mock/guitar.jpg" alt={t("Close-up of an acoustic guitar during worship rehearsal")} loading="lazy" />
          </div>
          <div>
            <p className="eyebrow">{t("From discovery to Sunday")}</p>
            <h2>{t("Everything you need to lead the song.")}</h2>
            <ul className="need">
              <li>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                {t("Chord charts in your key")}
              </li>
              <li>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>
                {t("Sheet music & lyrics")}
              </li>
              <li>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                {t("Tracks for rehearsal & worship")}
              </li>
            </ul>
            <Link className="more" to="/songs">{t("Explore the library →")}</Link>
          </div>
        </section>

        <section className="banner" id="writers">
          <div className="banner-copy">
            <h2>{t("Made for the Church.")}<br />{t("Shared with the Church.")}</h2>
            <div className="rule"></div>
            <div className="banner-side">
              {t("A growing library of freely shared worship music. Writers keep every commercial right.")}
              <br />
              <Link className="more" to="/mission">{t("Meet WorshipCommons →")}</Link>
              <br />
              <Link className="more" to="/call-for-songs" data-testid="home-call-for-songs">{t("Release a song →")}</Link>
            </div>
          </div>
          <div className="banner-photo">
            <img src="/mock/community.jpg" alt={t("Friends talking around a cafe table")} loading="lazy" />
          </div>
        </section>
      </div>
    </main>
  );
};
