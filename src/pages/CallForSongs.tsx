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
    t("Release a song you already mean to publish under the WorshipCommons License: churches anywhere can sing it free, you keep every commercial right, and worship use cannot be taken back.")
  );

  return (
    <main className="wrap-narrow" data-testid="call-for-songs">
      <div className="page-head">
        <span className="eyebrow">{t("For writers ready to release a song")}</span>
        <h1>{t("Write a song the church can actually sing.")}</h1>
        <p className="lede">{t("This is for a song you already mean to release — a finished original, a recording you already put out, a capstone someone else has already looked at. Churches anywhere can pick it up for free. Every commercial right stays yours. Worship use cannot be taken back.")}</p>
      </div>

      <div className="dark-panel big-quote">
        <h2>{t("If you are ready to give churches this song forever.")}</h2>
        <p>{t("A publishing deal does not unwind worship use. Asking us to take the song off the site does not either. Copies churches already have keep the grant.")}</p>
      </div>

      <section className="section" data-testid="forever-grant">
        <h2 style={{ marginBottom: 16 }}>{t("What you are deciding")}</h2>
        <div className="card official panel church">
          <ul>
            <li><Check />{t("You must be 18 or older.")}</li>
            <li><Check />{t("You wrote it, or you control the copyright, and every co-writer has agreed in writing.")}</li>
            <li><Check />{t("No publisher or performing-rights society has taken away your right to make this grant.")}</li>
            <li><Check />{t("Churches may keep every copy even if you later ask us to stop hosting.")}</li>
            <li><Check />{t("A class assignment is not a chain of title. A syllabus does not own the song.")}</li>
          </ul>
          <p className="note">{t("We can take a song off the site. We cannot recall a chart already on a stand. That is why the grant is forever, and why we only want it from people who can weigh that.")}</p>
        </div>
      </section>

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
              <li><Check />{t("Permanent — worship use stays with every copy, even if we stop hosting")}</li>
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
              <li><Star />{t("A support link on your writer page")}</li>
              <li><Star />{t("Full ownership of your song")}</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="section">
        <h2 style={{ marginBottom: 20 }}>{t("How it works")}</h2>
        <div className="card official">
          <h3>{t("Four steps")}</h3>
          <blockquote>
            <p><b>1 · </b>{t("The song — title, key, tempo, themes, and the words and chords.")}</p>
            <p><b>2 · </b>{t("The files — a chord chart, a demo recording, stems if you have them.")}</p>
            <p><b>3 · </b>{t("What you’re giving — worship use, forever. Not albums, not sync, not ticketed concerts.")}</p>
            <p><b>4 · </b>{t("Your word — you are 18, you wrote it, every co-writer agreed, and copies already out keep the grant.")}</p>
          </blockquote>
          <p className="note">{t("A human reviews every song before it goes live — usually within a few days.")}</p>
        </div>
      </section>

      <section className="section who" id="department">
        <h2 style={{ marginBottom: 20 }}>{t("If you teach songwriting")}</h2>
        <p>{t("A class or capstone can still use this as a release. The writer has to own the song and be 18. A syllabus is not a chain of title — the student makes the grant, not the department. Forward the paragraph below if it fits the assignment.")}</p>
        <div className="card official">
          <h3>{t("Copy this")}</h3>
          <blockquote>{t("WorshipCommons is a free, open library of worship music. A writer who is 18 or older and owns the song can release it under the WorshipCommons License — free for churches to sing, project, print, translate, and stream, forever, with every commercial right kept by the writer. Taking the song off the site later does not recall copies churches already have. It costs nothing, and it asks nothing of the churches that use it.")}<br />worshipcommons.org/license</blockquote>
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
