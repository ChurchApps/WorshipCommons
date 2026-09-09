import { Link } from "react-router-dom";
import "../styles/mission.css";
import { usePageMeta } from "../seo";
import { useI18n } from "../i18n";

export default function Mission() {
  const { t } = useI18n();
  usePageMeta(
    t("Our mission — WorshipCommons"),
    t("Take worship music out of the marketplace. Equip churches with quality songs and everything they need to use them on Sunday morning.")
  );

  return (
    <main className="mission" data-testid="mission-page">
      <header className="wrap-narrow page-head">
        <p className="eyebrow">{t("Our mission")}</p>
        <h1>{t("Worship music does not belong on an invoice.")}</h1>
        <p className="lede">{t("We exist to take worship songs out of the marketplace — and to put in every church’s hands the songs, charts, slides, and audio they actually need on Sunday morning.")}</p>
      </header>

      <div className="wrap-narrow">
        <div className="dark-panel mission-quote">
          <p>{t("A song is for singing. A church is for gathering. Sunday morning should never have been for sale.")}</p>
        </div>
      </div>

      <article className="wrap-narrow mission-prose">
        <p>{t("For a generation, churches have rented the songs they sing. A monthly fee. A reporting spreadsheet. A key you cannot change without buying another chart. A livestream that might trigger a claim. The music became inventory. The congregation became a customer.")}</p>
        <p>{t("That is not how worship works.")}</p>
        <p>{t("The people who write the songs should still make a living — from recordings, from sync, from the work that is actually a career. The singing itself should never have been a product. We are here to reverse that: to decommercialize worship music, without asking writers to give their careers away.")}</p>
      </article>

      <section className="wrap-narrow mission-jobs">
        <h2>{t("Two jobs. One library.")}</h2>
        <div className="mission-job">
          <h3>{t("Quality songs a church can actually use")}</h3>
          <p>{t("Public-domain hymns done properly. Originals whose writers certified a free-use grant. Not a dump of scans, and not a scholarship archive. Songs complete enough that a house church with a laptop and a four-hundred-person church with a band both start here.")}</p>
        </div>
        <div className="mission-job">
          <h3>{t("Everything required to use them on Sunday")}</h3>
          <p>{t("Hear it. Change the key. Print the chart. Put lyrics on a screen. Lead worship from a browser tab with nothing installed. Export to FreeShow or B1 if that is already the room. A free license is a hollow gift if the files still need a Thursday night of repair.")}</p>
        </div>
        <p className="mission-join">{t("The license is how we keep the first job honest. It is not the mission. The mission is a more singing church.")}</p>
      </section>

      <section className="wrap-narrow mission-means">
        <h2>{t("The license is a means.")}</h2>
        <p>{t("We wrote a one-page grant so a church can sing, print, project, arrange, translate, and stream — without asking, reporting, or paying — while every commercial right stays with the writer. Public-domain hymns need no grant at all. Some writers arrived with a Creative Commons license already on the song; we host those as they were given.")}</p>
        <p>{t("If you need the legal text, it lives on its own page. Read it. Then go find a song.")}</p>
        <p><Link to="/license" data-testid="mission-license">{t("Read the license →")}</Link></p>
      </section>

      <section className="wrap-narrow mission-cta">
        <h2>{t("A more singing church together")}</h2>
        <p>{t("Start with a hymn the church already knows, or share one you wrote. Either way, Sunday morning does not send a bill.")}</p>
        <div className="hero-ctas">
          <Link to="/songs" className="btn btn-primary">{t("Find Your Next Song →")}</Link>
          <Link to="/upload" className="btn btn-ghost">{t("Share a song")}</Link>
        </div>
      </section>
    </main>
  );
}
