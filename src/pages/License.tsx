import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import "../styles/license.css";
import { usePageMeta } from "../seo";
import { useI18n } from "../i18n";

const Check = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
);
const Star = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" /></svg>
);

export default function License() {
  const { t } = useI18n();
  usePageMeta(t("The WorshipCommons License — WorshipCommons"));
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.querySelector(hash)?.scrollIntoView();
  }, [hash]);

  // static editorial copy — the only markup in translations is <b>/<em>/<span>
  const rich = (key: string) => ({ __html: t(key) });

  return (
    <main className="wrap-narrow">
      <div className="page-head">
        <span className="eyebrow">{t("The license")}</span>
        <h1>{t("One page. Zero strings.")}</h1>
        <p className="lede">{t("Most music licensing is a subscription, a spreadsheet, and a lawyer. This is a page you can read out loud to your worship team.")}</p>
      </div>

      <div className="dark-panel big-quote">
        <h2 dangerouslySetInnerHTML={rich("“If it <span class=\"gold\">happens in worship</span> — singing it, projecting it, printing it, transposing it, translating it, recording it, streaming it — it’s <span class=\"violet\">free, forever</span>.”")} />
        <p>{t("That’s the whole deal. No subscriptions, no usage reports, no expiring permissions. Commercial use — albums, films, radio, concerts — still belongs to the writer, exactly as it should.")}</p>
      </div>

      <div className="card official">
        <h3>{t("The license, in full — Version 1.0")}</h3>
        <blockquote>
          <p dangerouslySetInnerHTML={rich("<b>1 · Worship Use</b> means performing, singing, or playing this song in the course of religious services or other gatherings held for worship — in a building, a home, online, anywhere — and everything done to prepare for and share those gatherings: rehearsing, projecting, printing, copying, distributing to the congregation, transposing, arranging, translating, recording, and streaming them, live or on demand.")} />
          <p dangerouslySetInnerHTML={rich("<b>2 · The grant.</b> Everyone taking part in or serving such worship is granted free, worldwide, non-exclusive, perpetual, and irrevocable permission to use this song — its words and music, together with the recordings and files shared with it — for Worship Use. This permission does not depend on the copyright law of any country; it applies identically everywhere.")} />
          <p dangerouslySetInnerHTML={rich("<b>3 · Everything else stays with the writer.</b> Any use that is not Worship Use — selling recordings or sheet music, sync licensing, broadcast, ticketed performances, rewriting the lyrics (translation aside) — needs the writer’s permission.")} />
        </blockquote>
        <p className="note">{t("These three paragraphs are the entire license; everything else on this page is explanation. Every song carries the license version in effect on the day it was shared. Crediting the writer is appreciated, never required.")}</p>
      </div>

      <section className="section">
        <h2 style={{ marginBottom: 24 }}>{t("Who gets what")}</h2>
        <div className="split">
          <div className="card panel church">
            <h3>{t("Your church gets")}</h3>
            <p className="sub">{t("Everything worship needs, free forever.")}</p>
            <ul>
              <li><Check /><span dangerouslySetInnerHTML={rich("<b>Project &amp; print</b> — screens, bulletins, songbooks")} /></li>
              <li><Check /><span dangerouslySetInnerHTML={rich("<b>Transpose &amp; arrange</b> — your key, your band, your sound")} /></li>
              <li><Check /><span dangerouslySetInnerHTML={rich("<b>Translate</b> — worship in your congregation’s language")} /></li>
              <li><Check /><span dangerouslySetInnerHTML={rich("<b>Record &amp; stream</b> — services live and on demand")} /></li>
            </ul>
          </div>
          <div className="card panel writer">
            <h3>{t("The writer keeps")}</h3>
            <p className="sub">{t("Every way a song actually earns money.")}</p>
            <ul>
              <li><Star /><span dangerouslySetInnerHTML={rich("<b>Recordings &amp; streaming</b> royalties")} /></li>
              <li><Star /><span dangerouslySetInnerHTML={rich("<b>Sync licensing</b> — film, TV, advertising")} /></li>
              <li><Star /><span dangerouslySetInnerHTML={rich("<b>Concerts, radio, sheet music</b> revenue")} /></li>
              <li><Star /><span dangerouslySetInnerHTML={rich("<b>Ownership</b> — the song never stops being theirs")} /></li>
            </ul>
          </div>
        </div>
      </section>

      <section className="section who" id="who">
        <h2 style={{ marginBottom: 20 }}>{t("Who counts as “worship”?")}</h2>
        <p dangerouslySetInnerHTML={rich("The U.S. gave the idea its shape: copyright law there lets congregations <em>sing</em> in a worship service without a license — but nothing around the singing: the screens, the bulletins, the new key, the translation, the livestream. Most countries don’t go even that far; in some, the singing itself needs a license.")} />
        <p dangerouslySetInnerHTML={rich("<span class=\"highlight\">So this license doesn’t lean on any country’s law.</span> It grants the singing <em>and</em> everything around it, directly from the writer, the same in every country. No statute lookup required.")} />
        <p>{t("If your gathering is held for worship — a service, wherever and however it meets — you qualify. A house church in Hanoi and a cathedral in Nairobi stand on equal footing with a chapel in Kansas.")}</p>
      </section>

      <section className="section">
        <h2 style={{ marginBottom: 8 }}>{t("The fine print, kept small")}</h2>
        <p style={{ color: "var(--muted)", fontSize: "0.9375rem", marginBottom: 22 }}>{t("Five things worth knowing. That’s all there is.")}</p>
        <details>
          <summary>{t("It can never be taken back")}</summary>
          <p>{t("Once a song is in the commons, the grant is permanent and irrevocable. A writer can stop promoting a song, but every church already singing it — and every copy, arrangement, translation, and recording made under the license — keeps its permission forever. A few countries let an author reclaim licenses by law decades later no matter what any license says (in the U.S., after 35 years); even then, everything already made under the license survives.")}</p>
        </details>
        <details>
          <summary>{t("Whoever shares a song promises they own it")}</summary>
          <p>{t("Uploading means certifying you wrote the song or control its rights — words, music, and every recording or file shared with it — with every co-writer, publisher, and recording owner on board. If someone shares a song that wasn’t theirs to share, the true owner can have it removed, and the uploader — not the churches that trusted the library — answers for the mistake.")}</p>
        </details>
        <details>
          <summary>{t("Arrangements and translations stay in the family")}</summary>
          <p>{t("Anything you make from a commons song under this license — a choral arrangement, a Spanish translation — is covered as worship use, and it creates no new commercial rights over the original. Contributing it back to the library is welcome, and sharing it there grants other churches the same freedom. One boundary: changing the lyrics themselves (beyond translating them) isn’t part of the grant — that stays a conversation with the writer.")}</p>
        </details>
        <details>
          <summary>{t("Crediting the writer is kindness, not a condition")}</summary>
          <p>{t("The grant has no attribution requirement — but keeping the writer’s name on your slides and chord charts is how a commons says thank you, and every download from this site includes it automatically.")}</p>
        </details>
        <details>
          <summary>{t("Songs come as-is")}</summary>
          <p>{t("The commons is a gift economy. Songs are shared in good faith and come without warranties. The uploader stands behind the promise of ownership; churches that relied on the license in good faith aren’t the ones on the hook if that promise fails.")}</p>
        </details>
      </section>

      <section className="section who" id="release">
        <h2 style={{ marginBottom: 20 }}>{t("Releasing a song without uploading it")}</h2>
        <p>{t("The library is optional. Like Creative Commons, the license works anywhere the writer declares it: put this notice on your chord chart, sheet music, album notes, or video description, and the song is released — no form, no account, no permission from us.")}</p>
        <div className="card official">
          <h3>{t("The release notice")}</h3>
          <blockquote>{t("“[Song title]” — words and music by [writer(s)].")}<br />{t("Released by the writer(s) under the WorshipCommons License, Version 1.0 — free for worship everywhere, forever; all commercial rights reserved.")}<br />worshipcommons.org/license</blockquote>
          <p className="note">{t("Short on space? “WorshipCommons License 1.0 · worshipcommons.org/license” in a footer is enough. Only someone who owns the song can release it — the same promise the upload form asks for, made in public. And once copies carrying the notice are out in the world, the release is as irrevocable as any upload.")}</p>
        </div>
      </section>

      <section className="section" id="faq">
        <h2 style={{ marginBottom: 22 }}>{t("Common questions")}</h2>
        <details>
          <summary>{t("Do we still report these songs to our licensing service?")}</summary>
          <p>{t("Nothing is owed to anyone for WorshipCommons songs. If your projection-license provider asks you to log everything you sing, you can list them for their statistics — but no royalty attaches.")}</p>
        </details>
        <details>
          <summary>{t("We’re not in the United States. Does any of this depend on U.S. law?")}</summary>
          <p>{t("No. The license doesn’t borrow from any country’s copyright exemptions — it grants everything itself, the singing included, directly from the writer, identically everywhere. Whatever your local law says about churches and music, your permission doesn’t depend on it.")}</p>
        </details>
        <details>
          <summary>{t("Can we post our worship recordings on YouTube?")}</summary>
          <p>{t("Yes. Recording and streaming your services is covered. Releasing a standalone commercial single or album of the song is not — that permission belongs to the writer.")}</p>
        </details>
        <details>
          <summary>{t("Our worship band got invited to a ticketed festival. Covered?")}</summary>
          <p>{t("That’s a concert, not a service — ask the writer, exactly as you would for any song. The license is careful to bless worship without quietly becoming a free commercial license.")}</p>
        </details>
        <details>
          <summary>{t("What’s the difference between “Free” and “Public domain” here?")}</summary>
          <p>{t("A public-domain song is free for every purpose, commercial included — the hymns fall here. A “Free” (WorshipCommons) song is free for worship while the writer keeps the commercial rights. The library labels every song.")}</p>
        </details>
        <details>
          <summary>{t("I co-wrote my song with someone. Can I add it?")}</summary>
          <p>{t("Only with every co-writer’s (and your publisher’s, if you have one) agreement. The upload promise is made on behalf of everyone with a stake in the song.")}</p>
        </details>
      </section>
    </main>
  );
}
