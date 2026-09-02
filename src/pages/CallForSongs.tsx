import { Link } from "react-router-dom";
import "../styles/license.css";
import { usePageMeta } from "../seo";
import { useI18n } from "../i18n";

const Check = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
);
const Star = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" /></svg>
);

export default function CallForSongs() {
  const { t } = useI18n();
  usePageMeta(
    t("Call for songs — WorshipCommons"),
    t("A call for songs from worship, music, and seminary students: release what you write under the WorshipCommons License so churches anywhere can sing it free, while you keep every commercial right.")
  );

  return (
    <main className="wrap-narrow" data-testid="call-for-songs">
      <div className="page-head">
        <span className="eyebrow">{t("For students and seminaries")}</span>
        <h1>{t("Write a song the church can actually sing.")}</h1>
        <p className="lede">{t("You are writing in a practicum, a chapel band, or a songwriting elective — and most of those songs are heard once and filed. Put one in the commons instead, and congregations anywhere can pick it up for free while every commercial right stays yours.")}</p>
      </div>

      <div className="dark-panel big-quote">
        <h2>{t("“Your first published song shouldn’t need a publisher.”")}</h2>
        <p>{t("WorshipCommons is an open library of worship music. Student and seminary writers are exactly who it was built for.")}</p>
      </div>

      <section className="section">
        <h2 style={{ marginBottom: 24 }}>{t("What WorshipCommons is")}</h2>
        <div className="split">
          <div className="card panel church">
            <h3>{t("An open library")}</h3>
            <p className="sub">{t("Free to use, clear to reuse.")}</p>
            <ul>
              <li><Check />{t("Free — no subscription, no reporting, no per-song fee")}</li>
              <li><Check />{t("Legally clear — one page you can read out loud to your team")}</li>
              <li><Check />{t("Remixable — new keys, new arrangements, new translations")}</li>
              <li><Check />{t("Permanent — released under the WorshipCommons License, Version 1.0")}</li>
            </ul>
          </div>
          <div className="card panel writer">
            <h3>{t("You keep:")}</h3>
            <ul>
              <li><Star />{t("Album sales & streaming royalties")}</li>
              <li><Star />{t("Sync — film, TV, and advertising")}</li>
              <li><Star />{t("Radio & broadcast royalties")}</li>
              <li><Star />{t("Ticketed concerts & tours")}</li>
              <li><Star />{t("Sheet music & songbook sales")}</li>
              <li><Star />{t("Full ownership of your song")}</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="section">
        <h2 style={{ marginBottom: 20 }}>{t("How it works")}</h2>
        <div className="card official">
          <h3>{t("Four quick steps")}</h3>
          <blockquote>
            <p><b>1 · </b>{t("The song — title, key, tempo, themes, and the words and chords.")}</p>
            <p><b>2 · </b>{t("The files — a chord chart, a demo recording, stems if you have them.")}</p>
            <p><b>3 · </b>{t("What you’re giving — worship use, and nothing else.")}</p>
            <p><b>4 · </b>{t("Your word that it’s yours to give — you wrote it, and every co-writer agrees.")}</p>
          </blockquote>
          <p className="note">{t("A human reviews every song before it goes live — usually within a few days.")}</p>
        </div>
      </section>

      <section className="section who" id="department">
        <h2 style={{ marginBottom: 20 }}>{t("Bring it to your department")}</h2>
        <p>{t("If your program has a songwriting class, a chapel band, or a capstone project, this works as an assignment: write it, record it, release it, and watch where it goes. Forward the paragraph below to your professor.")}</p>
        <div className="card official">
          <h3>{t("Copy this")}</h3>
          <blockquote>{t("WorshipCommons is a free, open library of worship music. Students can release what they write under the WorshipCommons License — free for churches to sing, project, print, translate, and stream, with every commercial right kept by the writer. It costs nothing, asks nothing of the churches that use it, and gives a class a real congregation instead of only a grade.")}<br />worshipcommons.org/license</blockquote>
          <p className="note">{t("Prefer to release a song without uploading it?")} <Link to="/license#release">{t("Copy the release notice.")}</Link></p>
        </div>
      </section>

      <section className="section">
        <Link to="/upload" className="btn btn-primary" data-testid="cfs-upload">{t("Share your song")}</Link>{" "}
        <Link to="/license#release" className="btn btn-ghost" data-testid="cfs-license">{t("Copy the release notice.")}</Link>
      </section>
    </main>
  );
}
