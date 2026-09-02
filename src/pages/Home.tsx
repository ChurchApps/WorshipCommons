import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { HOME_THEMES, loadSongs, Song, songRecency, themeList } from "../songs";
import { coverSvg } from "../cover.mjs";
import "../styles/home.css";
import { usePageMeta } from "../seo";
import { useI18n, SONG_LANG } from "../i18n";

const PlayIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
);

const NoteIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" /></svg>
);

const GlobeIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18" /></svg>
);

const PeopleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /></svg>
);

const ShieldIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6z" /><path d="M9 12h6M12 9v6" /></svg>
);

const PenIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z" /></svg>
);

const ArrowIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);

const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
);

export default function Home() {
  const { t, lang } = useI18n();
  usePageMeta(t("WorshipCommons — Worship music, set free"), t("An open library of worship music your church can sing free — public domain hymns and writer-shared songs with chord charts, lyrics, transposition, and audio."));
  const [songs, setSongs] = useState<Song[]>([]);
  useEffect(() => { loadSongs().then(setSongs); }, []);

  // /songs arrives sorted by downloadCount desc
  const top = songs.filter(s => s.language === SONG_LANG[lang]).slice(0, 10);
  const fromWriters = songs.filter(s => s.license === "WC").sort((a, b) => songRecency(b) - songRecency(a)).slice(0, 4);
  const stats = {
    songs: songs.length,
    downloads: songs.reduce((n, s) => n + s.downloadCount, 0),
    langs: new Set(songs.map(s => s.language)).size
  };

  return (
    <main>
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <span className="eyebrow rise">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" /></svg>
              {t("An open library of worship music")}
            </span>
            <h1 className="rise">{t("Worship music,")} <span className="hl">{t("set free.")}</span></h1>
            <p className="lede rise rise-2">{t("Every song here is free for your church to sing — project it, print it, change the key, stream it. No subscriptions, no reporting. Writers keep all the commercial rights.")}</p>
            <div className="hero-ctas rise rise-2">
              <Link to="/songs" className="btn btn-primary">{t("Explore the songs")}</Link>
              <a href="#writers" className="btn btn-ghost">{t("I write songs")}</a>
            </div>
            <p className="hero-proof rise rise-3">
              <span><NoteIcon /><strong>{stats.songs > 0 ? t("{count} songs", { count: stats.songs.toLocaleString() }) : t("Hundreds of songs")}</strong> {t("free for your church to use")}</span>
              <span><GlobeIcon /><strong>{t("{count} languages", { count: stats.langs })}</strong></span>
            </p>
          </div>
          <div className="hero-panel rise rise-3">
            <div className="hp-head">
              <Link className="hp-search" to="/songs">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                {t("Search {count} songs…", { count: stats.songs.toLocaleString() })}
              </Link>
              <Link className="hp-filters" to="/songs">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M3 6h18M7 12h10M10 18h4" /></svg>
                {t("Filters")}
              </Link>
            </div>
            <ul className="hp-list">
              {top.slice(0, 5).map((s, i) => (
                <li key={s.id} className={i === 0 ? "on" : ""}>
                  <Link to={`/songs/${s.id}`}>
                    {i === 0 && <span className="play-btn" aria-hidden="true"><PlayIcon size={12} /></span>}
                    {s.artUrl
                      ? <span className="hp-cover"><img src={s.artUrl.replace(/art\.webp$/, "art-thumb.webp")} alt="" loading="lazy" /></span>
                      : <span className="hp-cover" aria-hidden="true" dangerouslySetInnerHTML={{ __html: coverSvg(s, 88, 88) }} />}
                    <span className="hp-main"><b>{s.title}</b><span>{s.writer} • {s.year}</span></span>
                    <span className="hp-themes">{themeList(s).slice(0, 2).map(th => <span className="th" key={th}>{th}</span>)}</span>
                    <span className="hp-key">{s.songKey}</span>
                    <span className="hp-bpm">{s.bpm}</span>
                    {s.license === "WC"
                      ? <span className="free-badge">{t("Free")}</span>
                      : <span className="hp-pd" title={t("Public domain")}><GlobeIcon size={15} /></span>}
                  </Link>
                </li>
              ))}
            </ul>
            <Link className="hp-all" to="/songs">{t("Browse all songs")}<ArrowIcon /></Link>
          </div>
        </div>
      </section>

      <div className="trust-bar">
        <div className="wrap">
          <span><PeopleIcon />{t("Free for churches")}</span>
          <span><ShieldIcon />{t("Public domain songs")}</span>
          <span><PenIcon />{t("Writers keep all commercial rights")}</span>
          <span><GlobeIcon size={18} />{t("{count} languages and growing", { count: stats.langs })}</span>
          <span><NoteIcon />{t("{count} songs and counting", { count: stats.songs.toLocaleString() })}</span>
        </div>
      </div>

      <section className="block">
        <div className="wrap">
          <div className="sec-head animate-on-scroll">
            <h2>{t("One simple idea")}</h2>
            <p>{t("Music made for worship should be free to use in worship — and songwriters should still make a living from everything else.")}</p>
          </div>
          <div className="pillars">
            <div className="card card-hover pillar animate-on-scroll">
              <div className="icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg></div>
              <h3>{t("Free for your church")}</h3>
              <p>{t("Screens, bulletins, new keys, translations, livestreams — if it happens in worship, it's covered. No reporting, no subscription.")}</p>
              <Link className="pillar-link" to="/license">{t("Learn more")}<ArrowIcon /></Link>
            </div>
            <div className="card card-hover pillar animate-on-scroll">
              <div className="icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" /></svg></div>
              <h3>{t("Writers keep the rest")}</h3>
              <p>{t("Albums, streaming royalties, sync, radio, concerts — every commercial right stays with the songwriter. Generosity shouldn't cost a career.")}</p>
              <a className="pillar-link" href="#writers">{t("How it works")}<ArrowIcon /></a>
            </div>
            <div className="card card-hover pillar animate-on-scroll">
              <div className="icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg></div>
              <h3>{t("Built by the church")}</h3>
              <p>{t("Songs come from worship leaders and writers who want them sung. Popularity comes from congregations, not algorithms.")}</p>
              <Link className="pillar-link" to="/songs">{t("Explore the library")}<ArrowIcon /></Link>
            </div>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <div className="dark-panel browse animate-on-scroll">
            <div className="sec-head">
              <h2>{t("Find Sunday's song in seconds")}</h2>
              <p>{t("Search by theme, scripture, key, tempo, or language. Download chords, slides, ChordPro — and stems for the full band.")}</p>
            </div>
            <Link className="search-pill" to="/songs">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
              {t("Try “communion”, “Isaiah 40”, or “key of G”…")}
            </Link>
            <div className="chips">
              <span className="chip on">{t("All songs")}</span>
              {HOME_THEMES.map(th => (
                <Link key={th} className="chip" to={`/songs?theme=${th}`}>{th}</Link>
              ))}
              <Link className="chip" to="/songs?theme=Kids" data-testid="kids-chip">{t("Songs for kids and VBS")}</Link>
              <Link className="chip" to="/songs?lang=Spanish">En español</Link>
            </div>
            <div className="row-head">
              <h3>{t("Most downloaded in the commons")}</h3>
              <Link to="/songs">{t("See all →")}</Link>
            </div>
            <ul className="row-list">
              {top.slice(0, 4).map(s => (
                <li key={s.id}>
                  <span className="play-btn" aria-hidden="true"><PlayIcon size={12} /></span>
                  <div><Link to={`/songs/${s.id}`}><b>{s.title}</b></Link><div className="meta">{s.writer} · {(s.themes || "").split(",").slice(0, 2).join(", ")}</div></div>
                  <span className="kv">{s.songKey} · {s.bpm} BPM{s.downloadCount > 0 ? t(" · {count} downloads", { count: s.downloadCount.toLocaleString() }) : ""}</span>
                  <span className="free-badge">{t("Free")}</span>
                </li>
              ))}
            </ul>
            {fromWriters.length > 0 && (
              <>
                <div className="row-head">
                  <h3>{t("New from writers")}</h3>
                  <Link to="/songs">{t("See all →")}</Link>
                </div>
                <ul className="row-list">
                  {fromWriters.map(s => (
                    <li key={s.id}>
                      <span className="play-btn" aria-hidden="true"><PlayIcon size={12} /></span>
                      <div><Link to={`/songs/${s.id}`}><b>{s.title}</b></Link><div className="meta">{s.writer} · {(s.themes || "").split(",").slice(0, 2).join(", ")}</div></div>
                      <span className="kv">{s.songKey} · {s.bpm} BPM{s.year ? ` · ${s.year}` : ""}</span>
                      <span className="free-badge">{t("Free")}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <div className="sec-head animate-on-scroll">
            <h2>{t("Sunday-ready in three steps")}</h2>
            <p>{t("No accounts to manage, no licenses to buy, nothing to report back.")}</p>
          </div>
          <div className="steps">
            <div className="card step animate-on-scroll">
              <h3>{t("Find it")}</h3>
              <p>{t("Search the library by theme, scripture, key, tempo, or language. Listen to demo recordings before you commit.")}</p>
            </div>
            <div className="card step animate-on-scroll">
              <h3>{t("Grab everything")}</h3>
              <p>{t("Chord charts, lead sheets, slides, ChordPro — and multitracks where the writer shared them: separate stems for drums, bass, keys, and more, rendered in your key.")}</p>
            </div>
            <div className="card step animate-on-scroll">
              <h3>{t("Sing it your way")}</h3>
              <p>{t("New key, new arrangement, your language, your livestream. Sing it like it's yours — that's the whole point.")}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="block" id="writers">
        <div className="wrap writers">
          <div className="writers-copy animate-on-scroll">
            <h2>{t("Songwriters: give the song, keep the living")}</h2>
            <p>{t("Sharing your song with the church doesn't mean giving up your career. The commons covers worship use only — the revenue that actually pays writers stays 100% yours.")}</p>
            <p>{t("Upload your song, confirm you own it, and watch churches around the world start singing it.")}</p>
            <Link to="/upload" className="btn btn-primary">{t("Share your song")}</Link>
          </div>
          <div className="writers-card animate-on-scroll">
            <h3>{t("You keep:")}</h3>
            <ul className="keep-list">
              <li><CheckIcon />{t("Album sales & streaming royalties")}</li>
              <li><CheckIcon />{t("Sync — film, TV, and advertising")}</li>
              <li><CheckIcon />{t("Radio & broadcast royalties")}</li>
              <li><CheckIcon />{t("Ticketed concerts & tours")}</li>
              <li><CheckIcon />{t("Sheet music & songbook sales")}</li>
              <li><CheckIcon />{t("Full ownership of your song")}</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="wrap stats-band">
          <div className="stat animate-on-scroll"><b>{stats.songs.toLocaleString()}</b><span>{t("songs, growing weekly")}</span></div>
          <div className="stat animate-on-scroll"><b>{stats.downloads.toLocaleString()}</b><span>{t("downloads across the library")}</span></div>
          <div className="stat animate-on-scroll"><b>{stats.langs}</b><span>{t("languages and counting")}</span></div>
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <div className="cta animate-on-scroll">
            <h2>{t("Ready to sing something free?")}</h2>
            <p>{t("Browse the library, download everything you need for Sunday, and never fill out a licensing report for these songs again.")}</p>
            <Link to="/songs" className="btn btn-primary">{t("Explore the songs")}</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
