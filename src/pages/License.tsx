import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import "../styles/license.css";

const Check = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
);
const Star = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" /></svg>
);

export default function License() {
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.querySelector(hash)?.scrollIntoView();
  }, [hash]);

  return (
    <main className="wrap-narrow">
      <div className="page-head">
        <span className="eyebrow">The license</span>
        <h1>One page. Zero strings.</h1>
        <p className="lede">Most music licensing is a subscription, a spreadsheet, and a lawyer. This is a page you can read out loud to your worship team.</p>
      </div>

      <div className="dark-panel big-quote">
        <h2>&ldquo;If it <span className="gold">happens in worship</span> — singing it, projecting it, printing it, transposing it, translating it, recording it, streaming it — it&apos;s <span className="violet">free, forever</span>.&rdquo;</h2>
        <p>That&apos;s the whole deal. No subscriptions, no usage reports, no expiring permissions. Commercial use — albums, films, radio, concerts — still belongs to the writer, exactly as it should.</p>
      </div>

      <div className="card official">
        <h3>The license, in full — Version 1.0</h3>
        <blockquote>
          <p><b>1 · Worship Use</b> means performing, singing, or playing this song in the course of religious services or other gatherings held for worship — in a building, a home, online, anywhere — and everything done to prepare for and share those gatherings: rehearsing, projecting, printing, copying, distributing to the congregation, transposing, arranging, translating, recording, and streaming them, live or on demand.</p>
          <p><b>2 · The grant.</b> Everyone taking part in or serving such worship is granted free, worldwide, non-exclusive, perpetual, and irrevocable permission to use this song — its words and music, together with the recordings and files shared with it — for Worship Use. This permission does not depend on the copyright law of any country; it applies identically everywhere.</p>
          <p><b>3 · Everything else stays with the writer.</b> Any use that is not Worship Use — selling recordings or sheet music, sync licensing, broadcast, ticketed performances, rewriting the lyrics (translation aside) — needs the writer&apos;s permission.</p>
        </blockquote>
        <p className="note">These three paragraphs are the entire license; everything else on this page is explanation. Every song carries the license version in effect on the day it was shared. Crediting the writer is appreciated, never required.</p>
      </div>

      <section className="section">
        <h2 style={{ marginBottom: 24 }}>Who gets what</h2>
        <div className="split">
          <div className="card panel church">
            <h3>Your church gets</h3>
            <p className="sub">Everything worship needs, free forever.</p>
            <ul>
              <li><Check /><span><b>Project &amp; print</b> — screens, bulletins, songbooks</span></li>
              <li><Check /><span><b>Transpose &amp; arrange</b> — your key, your band, your sound</span></li>
              <li><Check /><span><b>Translate</b> — worship in your congregation&apos;s language</span></li>
              <li><Check /><span><b>Record &amp; stream</b> — services live and on demand</span></li>
            </ul>
          </div>
          <div className="card panel writer">
            <h3>The writer keeps</h3>
            <p className="sub">Every way a song actually earns money.</p>
            <ul>
              <li><Star /><span><b>Recordings &amp; streaming</b> royalties</span></li>
              <li><Star /><span><b>Sync licensing</b> — film, TV, advertising</span></li>
              <li><Star /><span><b>Concerts, radio, sheet music</b> revenue</span></li>
              <li><Star /><span><b>Ownership</b> — the song never stops being theirs</span></li>
            </ul>
          </div>
        </div>
      </section>

      <section className="section who" id="who">
        <h2 style={{ marginBottom: 20 }}>Who counts as &ldquo;worship&rdquo;?</h2>
        <p>The U.S. gave the idea its shape: copyright law there lets congregations <em>sing</em> in a worship service without a license — but nothing around the singing: the screens, the bulletins, the new key, the translation, the livestream. Most countries don&apos;t go even that far; in some, the singing itself needs a license.</p>
        <p><span className="highlight">So this license doesn&apos;t lean on any country&apos;s law.</span> It grants the singing <em>and</em> everything around it, directly from the writer, the same in every country. No statute lookup required.</p>
        <p>If your gathering is held for worship — a service, wherever and however it meets — you qualify. A house church in Hanoi and a cathedral in Nairobi stand on equal footing with a chapel in Kansas.</p>
      </section>

      <section className="section">
        <h2 style={{ marginBottom: 8 }}>The fine print, kept small</h2>
        <p style={{ color: "var(--muted)", fontSize: "0.9375rem", marginBottom: 22 }}>Five things worth knowing. That&apos;s all there is.</p>
        <details>
          <summary>It can never be taken back</summary>
          <p>Once a song is in the commons, the grant is permanent and irrevocable. A writer can stop promoting a song, but every church already singing it — and every copy, arrangement, translation, and recording made under the license — keeps its permission forever. A few countries let an author reclaim licenses by law decades later no matter what any license says (in the U.S., after 35 years); even then, everything already made under the license survives.</p>
        </details>
        <details>
          <summary>Whoever shares a song promises they own it</summary>
          <p>Uploading means certifying you wrote the song or control its rights — words, music, and every recording or file shared with it — with every co-writer, publisher, and recording owner on board. If someone shares a song that wasn&apos;t theirs to share, the true owner can have it removed, and the uploader — not the churches that trusted the library — answers for the mistake.</p>
        </details>
        <details>
          <summary>Arrangements and translations stay in the family</summary>
          <p>Anything you make from a commons song under this license — a choral arrangement, a Spanish translation — is covered as worship use, and it creates no new commercial rights over the original. Contributing it back to the library is welcome, and sharing it there grants other churches the same freedom. One boundary: changing the lyrics themselves (beyond translating them) isn&apos;t part of the grant — that stays a conversation with the writer.</p>
        </details>
        <details>
          <summary>Crediting the writer is kindness, not a condition</summary>
          <p>The grant has no attribution requirement — but keeping the writer&apos;s name on your slides and chord charts is how a commons says thank you, and every download from this site includes it automatically.</p>
        </details>
        <details>
          <summary>Songs come as-is</summary>
          <p>The commons is a gift economy. Songs are shared in good faith and come without warranties. The uploader stands behind the promise of ownership; churches that relied on the license in good faith aren&apos;t the ones on the hook if that promise fails.</p>
        </details>
      </section>

      <section className="section who" id="release">
        <h2 style={{ marginBottom: 20 }}>Releasing a song without uploading it</h2>
        <p>The library is optional. Like Creative Commons, the license works anywhere the writer declares it: put this notice on your chord chart, sheet music, album notes, or video description, and the song is released — no form, no account, no permission from us.</p>
        <div className="card official">
          <h3>The release notice</h3>
          <blockquote>&ldquo;[Song title]&rdquo; — words and music by [writer(s)].<br />Released by the writer(s) under the WorshipCommons License, Version 1.0 — free for worship everywhere, forever; all commercial rights reserved.<br />worshipcommons.org/license</blockquote>
          <p className="note">Short on space? &ldquo;WorshipCommons License 1.0 · worshipcommons.org/license&rdquo; in a footer is enough. Only someone who owns the song can release it — the same promise the upload form asks for, made in public. And once copies carrying the notice are out in the world, the release is as irrevocable as any upload.</p>
        </div>
      </section>

      <section className="section" id="faq">
        <h2 style={{ marginBottom: 22 }}>Common questions</h2>
        <details>
          <summary>Do we still report these songs to our licensing service?</summary>
          <p>Nothing is owed to anyone for WorshipCommons songs. If your projection-license provider asks you to log everything you sing, you can list them for their statistics — but no royalty attaches.</p>
        </details>
        <details>
          <summary>We&apos;re not in the United States. Does any of this depend on U.S. law?</summary>
          <p>No. The license doesn&apos;t borrow from any country&apos;s copyright exemptions — it grants everything itself, the singing included, directly from the writer, identically everywhere. Whatever your local law says about churches and music, your permission doesn&apos;t depend on it.</p>
        </details>
        <details>
          <summary>Can we post our worship recordings on YouTube?</summary>
          <p>Yes. Recording and streaming your services is covered. Releasing a standalone commercial single or album of the song is not — that permission belongs to the writer.</p>
        </details>
        <details>
          <summary>Our worship band got invited to a ticketed festival. Covered?</summary>
          <p>That&apos;s a concert, not a service — ask the writer, exactly as you would for any song. The license is careful to bless worship without quietly becoming a free commercial license.</p>
        </details>
        <details>
          <summary>What&apos;s the difference between &ldquo;Free&rdquo; and &ldquo;Public domain&rdquo; here?</summary>
          <p>A public-domain song is free for every purpose, commercial included — the hymns fall here. A &ldquo;Free&rdquo; (WorshipCommons) song is free for worship while the writer keeps the commercial rights. The library labels every song.</p>
        </details>
        <details>
          <summary>I co-wrote my song with someone. Can I add it?</summary>
          <p>Only with every co-writer&apos;s (and your publisher&apos;s, if you have one) agreement. The upload promise is made on behalf of everyone with a stake in the song.</p>
        </details>
      </section>
    </main>
  );
}
