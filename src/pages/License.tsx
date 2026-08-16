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

// Binding text — English in every locale. If the deed and this text disagree, this text controls.
function LegalCode() {
  return (
    <div className="legal-body" lang="en">
      <h4>WorshipCommons License, Version 1.0 — Legal Code</h4>
      <p>This is the license. The page at worshipcommons.org/license is a summary. If the summary and this text disagree, this text controls.</p>

      <h4>1. Definitions</h4>
      <p>Song means the words and music of the work this license is applied to, plus every recording and file the Writer shared with it and marked with this license.</p>
      <p>Writer means each person or entity that owns rights in the Song and applies this license.</p>
      <p>{"Worship Gathering means a gathering held for worship — including a service, camp, youth gathering, household or personal devotion, wedding, funeral, chapel, retreat, hospital or prison visit, or similar assembly — wherever it happens, in person or online."}</p>
      <p>{"Worship Use means singing, playing, or performing the Song at a Worship Gathering, and everything done to prepare for or share that gathering: rehearsing; projecting, printing, copying, and giving words or music to the people gathered without selling them as a product; transposing and arranging; translating; and recording or streaming that gathering, live or later."}</p>

      <h4>2. Grant</h4>
      <p>The Writer grants everyone a free, worldwide, non-exclusive, perpetual, irrevocable license to use the Song for Worship Use.</p>
      <p>You do not need to ask, register, report, or pay. You do not need to pass this permission along. Everyone already has it from the Writer.</p>
      <p>You may let people and services working for you do only what is needed for your Worship Use (a projection tool, a print shop, a streaming host). That is not a general sublicense.</p>
      <p>This grant is the Writer’s own permission. It does not rely on any country’s church-copyright exemption.</p>

      <h4>3. What is not granted</h4>
      <p>{"Everything that is not Worship Use stays with the Writer and needs the Writer’s permission. That includes: selling recordings or sheet music; releasing a standalone track, album, or music video; using the Song in film, television, advertising, a podcast, a game, or another production; radio or television broadcast of the Song apart from sharing a Worship Gathering; and a ticketed concert where the performance is the product."}</p>
      <p>Taking an offering, charging for camp or a conference, or letting ads or donation prompts run on a church’s stream of a Worship Gathering is still Worship Use.</p>

      <h4>4. Changes</h4>
      <p>{"You may skip a verse, repeat a part, translate the Song, or change a word so it sings, as long as you do not change what the Song means or present a changed version as the original. Other lyric changes need the Writer’s permission."}</p>
      <p>{"An arrangement or translation you make for Worship Use creates no commercial rights in the original Song. If you share that arrangement or translation through WorshipCommons, you grant others the same Worship Use permission in your contribution. You keep your other rights in that contribution."}</p>

      <h4>5. If local law gets in the way</h4>
      <p>This license is meant to work in every country. Where local law will not carry all of it, the Writer grants as much as that law allows and promises not to sue anyone for Worship Use.</p>
      <p>To the extent the law allows, the Writer will not assert moral rights, or any similar right, to stop Worship Use.</p>
      <p>If one part of this license is unenforceable, the rest still stands.</p>
      <p>In the United States, copyright law lets an author terminate certain grants after 35 years even if a license says otherwise. Uses and copies already made under this license survive that termination to the extent the law allows.</p>

      <h4>6. Credit, warranties, version</h4>
      <p>Crediting the Writer is appreciated and is not a condition of this license, except where the law requires credit.</p>
      <p>The Song is provided as-is, with no warranties, as far as the law allows. This license covers only rights the Writer actually holds.</p>
      <p>Each Song carries the license version in effect on the day it was shared. A later version does not change a Song already shared unless the Writer applies the later version.</p>
      <p>Only someone who owns the Song can apply this license. Applying it is a public grant and, once copies are out in the world, is as irrevocable as an upload.</p>
    </div>
  );
}

export default function License() {
  const { t } = useI18n();
  usePageMeta(t("The WorshipCommons License — WorshipCommons"));
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const el = document.querySelector(hash);
    if (el instanceof HTMLDetailsElement) el.open = true;
    el?.scrollIntoView();
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
        <h2 dangerouslySetInnerHTML={rich("“If it <span class=\"gold\">happens in worship</span>, it’s <span class=\"violet\">free, forever</span>.”")} />
        <p>{t("Albums, films, and ticketed concerts stay with the writer.")}</p>
      </div>

      <div className="card official">
        <h3>{t("The license — Version 1.0")}</h3>
        <blockquote>
          <p dangerouslySetInnerHTML={rich("<b>1 · Worship Use.</b> Using this song in worship — a service, camp, home, or any gathering held for worship, anywhere — and everything done to prepare for and share it: rehearsing, projecting, printing, arranging, translating, recording or streaming the gathering.")} />
          <p dangerouslySetInnerHTML={rich("<b>2 · The grant.</b> Free, worldwide, forever. You don’t ask, register, report, or pay. This is the writer’s own permission, not a church exemption.")} />
          <p dangerouslySetInnerHTML={rich("<b>3 · Everything else stays with the writer.</b> Selling recordings or sheet music, standalone releases, sync, and ticketed concerts need the writer. Skip a verse or translate it; don’t change what the song means.")} />
        </blockquote>
        <p className="note">{t("These three paragraphs are a summary.")} <a href="#legal">{t("The legal code is the license.")}</a> {t("If they disagree, the legal code controls. Every song carries the license version in effect on the day it was shared. Crediting the writer is appreciated, never required.")}</p>
      </div>

      <details className="card official legal" id="legal" open>
        <summary>{t("Legal code — Version 1.0")}</summary>
        <p className="note">{t("The legal code is the license.")} {t("The binding legal code is in English.")}</p>
        <LegalCode />
      </details>

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
        <p dangerouslySetInnerHTML={rich("<span class=\"highlight\">This is the writer’s own permission, not a church exemption.</span> It grants the singing <em>and</em> everything around it, directly from the writer, the same in every country.")} />
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
          <p>{t("Uploading means certifying you wrote the song or control its rights — words, music, and every recording or file shared with it — with every co-writer, publisher, and recording owner on board, and that no society, publisher, or admin has taken away your right to make the grant. If someone shares a song that wasn’t theirs to share, the true owner can have it removed, and the uploader — not the churches that trusted the library — answers for the mistake.")}</p>
        </details>
        <details>
          <summary>{t("Arrangements and translations stay in the family")}</summary>
          <p>{t("Anything you make from a commons song under this license — a choral arrangement, a Spanish translation — is covered as worship use, and it creates no new commercial rights over the original. Contributing it back to the library is welcome, and sharing it there grants other churches the same freedom. You may skip a verse, repeat a part, translate the song, or change a word so it sings — don’t change what the song means, or present a changed version as the original. Other lyric changes need the writer.")}</p>
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
          <blockquote>{t("“[Song title]” — words and music by [writer(s)].")}<br />{t("Released by the writer(s) under the WorshipCommons License, Version 1.0 — free for worship everywhere, forever; all commercial rights reserved.")}<br />worshipcommons.org/license#legal</blockquote>
          <p className="note">{t("Short on space? “WorshipCommons License 1.0 · worshipcommons.org/license#legal” in a footer is enough. Only someone who owns the song can release it — the same promise the upload form asks for, made in public. And once copies carrying the notice are out in the world, the release is as irrevocable as any upload.")}</p>
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
          <p>{t("No. This is the writer’s own permission, not a church exemption. It grants the singing and everything around it, directly from the writer, the same in every country. Whatever your local law says about churches and music, you don’t need that exemption — you already have the writer’s grant.")}</p>
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
