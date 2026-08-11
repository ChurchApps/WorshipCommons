import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loadSongs, Song } from "../songs";
import "../styles/home.css";

const PlayIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
);

const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
);

const TICKER = [
  ["Every Valley", "D"],
  ["Bread and Cup", "G"],
  ["Amazing Grace", "G"],
  ["The Lord Is Near", "Bb"],
  ["Tunakuabudu", "F"],
  ["Morning Will Come", "C"],
  ["Be Thou My Vision", "E"],
  ["Rise Up, O Sleeper", "A"],
  ["Todo Valle", "D"],
  ["House of Bread", "F"]
];

export default function Home() {
  const [songs, setSongs] = useState<Song[]>([]);
  useEffect(() => { loadSongs().then(setSongs); }, []);
  const linkFor = (title: string) => {
    const song = songs.find(s => s.title === title);
    return song ? `/songs/${song.id}` : "/songs";
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
              An open library of worship music
            </span>
            <h1 className="rise">Worship music, <span className="hl">set free.</span></h1>
            <p className="lede rise rise-2">Every song here is free for your church to sing — project it, print it, change the key, stream it. No subscriptions, no reporting, no strings. Writers keep all the commercial rights.</p>
            <div className="hero-ctas rise rise-2">
              <Link to="/songs" className="btn btn-primary">Explore the songs</Link>
              <a href="#writers" className="btn btn-ghost">I write songs</a>
            </div>
            <p className="hero-proof rise rise-3"><strong>4,108 churches</strong> are already singing from the commons</p>
          </div>
          <div className="card-stack rise rise-3" aria-hidden="true">
            <div className="song-card sc1">
              <button className="play-btn" aria-label="Play Every Valley"><PlayIcon /></button>
              <div><b>Every Valley</b><span>Miriam Okafor · Key of D</span></div>
              <span className="free-badge">Free</span>
            </div>
            <div className="song-card sc2">
              <button className="play-btn" aria-label="Play The Lord Is Near"><PlayIcon /></button>
              <div><b>The Lord Is Near</b><span>Mbeki &amp; Cho · 126 BPM</span></div>
              <span className="free-badge">Free</span>
            </div>
            <div className="song-card sc3">
              <button className="play-btn" aria-label="Play Rise Up O Sleeper"><PlayIcon /></button>
              <div><b>Rise Up, O Sleeper</b><span>Daniel Antwi · Easter</span></div>
              <span className="free-badge">Free</span>
            </div>
          </div>
        </div>
      </section>

      <div className="ticker" aria-hidden="true">
        <div className="ticker-track">
          {[0, 1].map(pass => TICKER.map(([title, key]) => (
            <span key={pass + title}>{title} <b>· {key} ·</b></span>
          )))}
        </div>
      </div>

      <section className="block">
        <div className="wrap">
          <div className="sec-head animate-on-scroll">
            <h2>One simple idea</h2>
            <p>Music made for worship should be free to use in worship — and songwriters should still make a living from everything else.</p>
          </div>
          <div className="pillars">
            <div className="card card-hover pillar animate-on-scroll">
              <div className="icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg></div>
              <h3>Free for your church</h3>
              <p>Screens, bulletins, new keys, translations, livestreams — if it happens in worship, it's covered. Forever, everywhere, at no cost.</p>
            </div>
            <div className="card card-hover pillar animate-on-scroll">
              <div className="icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" /></svg></div>
              <h3>Writers keep the rest</h3>
              <p>Albums, streaming royalties, sync, radio, concerts — every commercial right stays with the songwriter. Generosity shouldn't cost a career.</p>
            </div>
            <div className="card card-hover pillar animate-on-scroll">
              <div className="icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg></div>
              <h3>Built by the church</h3>
              <p>Songs come from worship leaders and writers who want them sung. Popularity comes from congregations, not algorithms.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <div className="dark-panel browse animate-on-scroll">
            <div className="sec-head">
              <h2>Find Sunday's song in seconds</h2>
              <p>Search by theme, scripture, key, tempo, or language. Download chords, slides, ChordPro — and stems for the full band.</p>
            </div>
            <Link className="search-pill" to="/songs">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
              Try &ldquo;communion&rdquo;, &ldquo;Isaiah 40&rdquo;, or &ldquo;key of G&rdquo;&hellip;
            </Link>
            <div className="chips">
              <span className="chip on">All songs</span>
              {["Praise", "Communion", "Advent", "Easter", "Comfort", "Justice"].map(t => (
                <Link key={t} className="chip" to={`/songs?theme=${t}`}>{t}</Link>
              ))}
              <Link className="chip" to="/songs?lang=Spanish">En español</Link>
            </div>
            <ul className="row-list">
              {[
                { t: "Every Valley", meta: "Miriam Okafor · Advent, Comfort", kv: "D · 72 BPM · 312 churches" },
                { t: "Bread and Cup", meta: "Andrés Delgado · Communion", kv: "G · 68 BPM · 268 churches" },
                { t: "Amazing Grace", meta: "John Newton · Grace, Assurance", kv: "G · 84 BPM · 1,893 churches" },
                { t: "Tunakuabudu", meta: "Esther Wanjiru · Praise · Swahili", kv: "F · 96 BPM · 143 churches" }
              ].map(row => (
                <li key={row.t}>
                  <span className="play-btn" aria-hidden="true"><PlayIcon size={12} /></span>
                  <div><Link to={linkFor(row.t)}><b>{row.t}</b></Link><div className="meta">{row.meta}</div></div>
                  <span className="kv">{row.kv}</span>
                  <span className="free-badge">Free</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <div className="sec-head animate-on-scroll">
            <h2>Sunday-ready in three steps</h2>
            <p>No accounts to manage, no licenses to buy, nothing to report back.</p>
          </div>
          <div className="steps">
            <div className="card step animate-on-scroll">
              <h3>Find it</h3>
              <p>Search the library by theme, scripture, key, tempo, or language. Listen to demo recordings before you commit.</p>
            </div>
            <div className="card step animate-on-scroll">
              <h3>Grab everything</h3>
              <p>Chord charts, lead sheets, slides, ChordPro — and multitracks where the writer shared them: separate stems for drums, bass, keys, and more, rendered in your key.</p>
            </div>
            <div className="card step animate-on-scroll">
              <h3>Sing it your way</h3>
              <p>New key, new arrangement, your language, your livestream. Sing it like it's yours — that's the whole point.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="block" id="writers">
        <div className="wrap writers">
          <div className="writers-copy animate-on-scroll">
            <h2>Songwriters: give the song, keep the living</h2>
            <p>Sharing your song with the church doesn't mean giving up your career. The commons covers worship use only — the revenue that actually pays writers stays 100% yours.</p>
            <p>Upload your song, confirm you own it, and watch churches around the world start singing it.</p>
            <Link to="/upload" className="btn btn-primary">Share your song</Link>
          </div>
          <div className="writers-card animate-on-scroll">
            <h3>You keep:</h3>
            <ul className="keep-list">
              <li><CheckIcon />Album sales &amp; streaming royalties</li>
              <li><CheckIcon />Sync — film, TV, and advertising</li>
              <li><CheckIcon />Radio &amp; broadcast royalties</li>
              <li><CheckIcon />Ticketed concerts &amp; tours</li>
              <li><CheckIcon />Sheet music &amp; songbook sales</li>
              <li><CheckIcon />Full ownership of your song</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="wrap stats-band">
          <div className="stat animate-on-scroll"><b>312</b><span>songs, growing weekly</span></div>
          <div className="stat animate-on-scroll"><b>4,108</b><span>churches singing them</span></div>
          <div className="stat animate-on-scroll"><b>41</b><span>languages and counting</span></div>
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <div className="cta animate-on-scroll">
            <h2>Ready to sing something free?</h2>
            <p>Browse the library, download everything you need for Sunday, and never fill out a licensing report for these songs again.</p>
            <Link to="/songs" className="btn btn-primary">Explore the songs</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
