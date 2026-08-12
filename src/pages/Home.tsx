import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loadSongs, Song } from "../songs";
import "../styles/home.css";
import { usePageMeta } from "../seo";
import { useI18n, SONG_LANG } from "../i18n";

const PlayIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
);

const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
);

export default function Home() {
  const { t, lang } = useI18n();
  usePageMeta(t("WorshipCommons — Worship music, set free"), t("An open library of worship music your church can sing free — public domain hymns and writer-shared songs with chord charts, lyrics, transposition, and audio."));
  const [songs, setSongs] = useState<Song[]>([]);
  useEffect(() => { loadSongs().then(setSongs); }, []);

  // /songs arrives sorted by churchCount desc
  const top = songs.filter(s => s.language === SONG_LANG[lang]).slice(0, 10);
  const stats = {
    songs: songs.length,
    sings: songs.reduce((n, s) => n + s.churchCount, 0),
    langs: new Set(songs.map(s => s.language)).size
  };

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add("visible"); observer.unobserve(entry.target); }
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });
    document.querySelectorAll(".animate-on-scroll").forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

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
            <p className="lede rise rise-2">{t("Every song here is free for your church to sing — project it, print it, change the key, stream it. No subscriptions, no reporting, no strings. Writers keep all the commercial rights.")}</p>
            <div className="hero-ctas rise rise-2">
              <Link to="/songs" className="btn btn-primary">{t("Explore the songs")}</Link>
              <a href="#writers" className="btn btn-ghost">{t("I write songs")}</a>
            </div>
            <p className="hero-proof rise rise-3"><strong>{stats.songs > 0 ? t("{count} songs", { count: stats.songs.toLocaleString() }) : t("Hundreds of songs")}</strong> {t("free for your church to sing, in {langs}", { langs: stats.langs > 1 ? t("{count} languages", { count: stats.langs }) : t("any language") })}</p>
          </div>
          <div className="card-stack rise rise-3" aria-hidden="true">
            {top.slice(0, 3).map((s, i) => (
              <div className={`song-card sc${i + 1}`} key={s.id}>
                <button className="play-btn" aria-label={t("Play {title}", { title: s.title })}><PlayIcon /></button>
                <div><b>{s.title}</b><span>{s.writer} · {t("Key of {key}", { key: s.songKey })}</span></div>
                <span className="free-badge">{t("Free")}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="ticker" aria-hidden="true">
        <div className="ticker-track">
          {[0, 1].map(pass => top.map(s => (
            <span key={pass + s.id}>{s.title} <b>· {s.songKey} ·</b></span>
          )))}
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
              <p>{t("Screens, bulletins, new keys, translations, livestreams — if it happens in worship, it's covered. Forever, everywhere, at no cost.")}</p>
            </div>
            <div className="card card-hover pillar animate-on-scroll">
              <div className="icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" /></svg></div>
              <h3>{t("Writers keep the rest")}</h3>
              <p>{t("Albums, streaming royalties, sync, radio, concerts — every commercial right stays with the songwriter. Generosity shouldn't cost a career.")}</p>
            </div>
            <div className="card card-hover pillar animate-on-scroll">
              <div className="icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg></div>
              <h3>{t("Built by the church")}</h3>
              <p>{t("Songs come from worship leaders and writers who want them sung. Popularity comes from congregations, not algorithms.")}</p>
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
              {["Praise", "Communion", "Advent", "Easter", "Comfort", "Justice"].map(th => (
                <Link key={th} className="chip" to={`/songs?theme=${th}`}>{th}</Link>
              ))}
              <Link className="chip" to="/songs?lang=Spanish">En español</Link>
            </div>
            <ul className="row-list">
              {top.slice(0, 4).map(s => (
                <li key={s.id}>
                  <span className="play-btn" aria-hidden="true"><PlayIcon size={12} /></span>
                  <div><Link to={`/songs/${s.id}`}><b>{s.title}</b></Link><div className="meta">{s.writer} · {(s.themes || "").split(",").slice(0, 2).join(", ")}</div></div>
                  <span className="kv">{s.songKey} · {s.bpm} BPM{s.churchCount > 0 ? t(" · {count} churches", { count: s.churchCount.toLocaleString() }) : ""}</span>
                  <span className="free-badge">{t("Free")}</span>
                </li>
              ))}
            </ul>
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
          <div className="stat animate-on-scroll"><b>{stats.sings.toLocaleString()}</b><span>{t("times a church said “we sing this”")}</span></div>
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
