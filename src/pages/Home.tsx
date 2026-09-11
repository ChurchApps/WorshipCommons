import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { coverOf, kindOf, loadSongs, Song, songPath } from "../songs";
import { coverSvg } from "../cover.mjs";
import { loadTune, TunePlayer } from "../midiPlayer";
import { libraryIds, setInLibrary } from "../library";
import { useAuth } from "../auth";
import "../styles/home.css";
import { usePageMeta } from "../seo";
import { useI18n, SONG_LANG } from "../i18n";
import { splitLanguages, topBlock } from "../catalog";

const PlayIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>;
const StopIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2" /></svg>;
const SaveIcon = ({ on }: { on: boolean }) => <svg width="14" height="14" viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 4h12v16l-6-4-6 4z" /></svg>;
const SearchIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>;

// the chips deep-link into the library: theme, license, readiness, and recency are all real /songs filters
const CHIPS: [string, string][] = [
  ["All Songs", "/songs"],
  ["Modern Worship", "/songs?license=WC"],
  ["Timeless Hymns", "/songs?license=PD"],
  ["Acoustic", "/songs?guitar=1"],
  ["New Releases", "/songs?sort=new"]
];

export default function Home() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  usePageMeta(t("WorshipCommons — Great music. For every church."), t("Discover worship songs, timeless hymns, and the resources to lead them. All freely shared with the Church."));
  const [songs, setSongs] = useState<Song[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tuneRef = useRef<TunePlayer | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => { loadSongs().then(setSongs); }, []);
  useEffect(() => { if (user) libraryIds().then(setSaved); else setSaved([]); }, [user]);
  const stopAll = () => { audioRef.current?.pause(); tuneRef.current?.stop(); tuneRef.current = null; setPlaying(null); };
  useEffect(() => () => { audioRef.current?.pause(); tuneRef.current?.stop(); }, []);

  const block = topBlock(songs, SONG_LANG[lang]);
  const set = block.songs.slice(0, 4);
  const { catalog, browse } = splitLanguages(songs);
  const counted = catalog.length ? songs.filter(s => catalog.includes(s.language)) : songs;

  // demo recording if there is one, otherwise the melody file through the piano soundfont
  const togglePlay = async (s: Song) => {
    const was = playing === s.id;
    stopAll();
    if (was || !(s.demoAudioUrl || s.midiUrl)) return;
    setPlaying(s.id);
    if (s.demoAudioUrl) {
      const a = new Audio(s.demoAudioUrl);
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

  const toggleSave = async (s: Song) => {
    if (!user) { navigate(`/login?next=${encodeURIComponent(location.pathname)}`); return; }
    const on = saved.includes(s.id);
    await setInLibrary(s.id, !on);
    setSaved(on ? saved.filter(id => id !== s.id) : [...saved, s.id]);
  };

  const search = (e: FormEvent) => { e.preventDefault(); navigate(q.trim() ? `/songs?q=${encodeURIComponent(q.trim())}` : "/songs"); };

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
              <span><strong>{t("{count} songs", { count: counted.length.toLocaleString() })}</strong> {t("free for your church to use")}</span>
              <span><strong>{t("{count} languages", { count: catalog.length || browse.length })}</strong>{catalog.length > 0 && browse.length > 0 && <> <small data-testid="browse-langs">{t("+ {count} browse languages", { count: browse.length })}</small></>}</span>
            </p>
          </div>
          <div className="hero-photo rise rise-3">
            <img src="/mock/hero-band.jpg" alt={t("A worship band rehearsing: singer, guitar, and keys in a sunlit loft")} />
          </div>
        </div>
      </section>

      <div className="wrap">
        <form className="search-row" onSubmit={search} role="search">
          <label className="field">
            <SearchIcon />
            <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={t("Search songs, lyrics, scripture, or themes…")} aria-label={t("Search songs")} />
          </label>
          <button className="btn btn-primary" type="submit">{t("Search")}</button>
        </form>
        <div className="chips">
          {CHIPS.map(([label, to], i) => <Link key={label} className={"chip" + (i === 0 ? " on" : "")} to={to}>{t(label)}</Link>)}
          <Link className="chip" to="/songs?theme=Kids" data-testid="kids-chip">{t("Kids & VBS")}</Link>
        </div>

        <div className="sec-head">
          <div>
            <p className="kicker" data-testid="home-top-heading">{t(block.heading)}</p>
            <h2>{t("Find your next Sunday set.")}</h2>
            <p>{t("Songs worth singing. Resources ready to go.")}</p>
          </div>
          <Link className="more" to={block.heading === "Sunday-ready" ? "/songs?confidence=sunday-ready" : "/songs"}>{t("Explore all songs →")}</Link>
        </div>

        <ul className="albums" data-testid="home-top-list">
          {set.map(s => {
            const cover = coverOf(s);
            return (
            <li key={s.id} className="album">
              <div className="album-art">
                <Link to={`${songPath(s)}`} aria-label={s.title}>
                  {cover
                    ? <img className={cover.portrait ? "portrait" : "art"} src={cover.src} alt="" loading="lazy" />
                    : <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: coverSvg(s, 400, 400) }} />}
                  {!(cover?.portrait) && <span className="album-title" aria-hidden="true">{s.title}</span>}
                </Link>
                {(s.demoAudioUrl || s.midiUrl) && (
                  <button className="play" type="button" aria-label={t(playing === s.id ? "Stop {title}" : "Play {title}", { title: s.title })} onClick={() => togglePlay(s)}>
                    {playing === s.id ? <StopIcon /> : <PlayIcon />}
                  </button>
                )}
                <button className={"save" + (saved.includes(s.id) ? " on" : "")} type="button" aria-pressed={saved.includes(s.id)} aria-label={t(saved.includes(s.id) ? "Remove {title} from saved songs" : "Save {title}", { title: s.title })} onClick={() => toggleSave(s)}>
                  <SaveIcon on={saved.includes(s.id)} />
                </button>
              </div>
              <h3><Link to={`${songPath(s)}`} className="album">{s.title}</Link></h3>
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
              <Link className="more" to="/call-for-songs">{t("For students and seminaries →")}</Link>
            </div>
          </div>
          <div className="banner-photo">
            <img src="/mock/community.jpg" alt={t("Friends talking around a cafe table")} loading="lazy" />
          </div>
        </section>
      </div>
    </main>
  );
}
