import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loadSongs, Song, songPath } from "../songs";
import { usePageMeta } from "../seo";
import { useI18n } from "../i18n";
import { licenseOf } from "../licenses";
import { COLLECTIONS, collectionBySlug, collectionSongs, groupByLanguage } from "../collections.mjs";

// Seasonal sets, public-domain hymns, and the no-CCLI list. The copy lives in
// src/collections.mjs so tools/prerender.mjs writes the same words for crawlers.
export const Collection: React.FC<{ slug: string }> = (props) => {
  const { t } = useI18n();
  const collection = collectionBySlug(props.slug);
  usePageMeta(collection.title, collection.description);
  const [songs, setSongs] = useState<Song[] | null>(null);
  useEffect(() => {
    let live = true;
    loadSongs().then(all => { if (live) setSongs(collectionSongs(collection, all)); }).catch(() => { if (live) setSongs([]); });
    return () => { live = false; };
  }, [props.slug]);

  const groups = songs ? (collection.limit ? [["", songs] as [string, Song[]]] : groupByLanguage(songs)) : [];

  return (
    <main className="wrap-narrow" data-testid={`collection-${collection.slug}`}>
      <div className="page-head">
        <span className="eyebrow"><Link to="/songs">{t("Song library")}</Link></span>
        <h1>{collection.h1}</h1>
        {collection.intro.map((p, i) => <p key={i} className={i === 0 ? "lede" : undefined}>{p}</p>)}
      </div>

      {collection.faq && (
        <section style={{ margin: "24px 0" }}>
          {collection.faq.map(([q, a]) => (
            <div key={q} style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: "1.125rem", marginBottom: 4 }}>{q}</h2>
              <p>{a}</p>
            </div>
          ))}
        </section>
      )}

      {!songs && <p>{t("Loading…")}</p>}
      {songs?.length === 0 && <p>{t("No songs found")}</p>}
      <div data-testid="collection-songs">
        {groups.map(([lang, list]) => (
          <section key={lang || "all"}>
            {groups.length > 1 && <h2 style={{ margin: "32px 0 12px", fontSize: "0.9375rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>{t(lang)}</h2>}
            <ul style={{ listStyle: "none" }}>
              {list.map(s => (
                <li key={s.id} className="card" style={{ padding: 20, marginBottom: 12 }} data-testid="collection-song">
                  <h3 style={{ marginBottom: 4 }}><Link to={songPath(s)}>{s.title}</Link></h3>
                  <p className="hint">{s.writer}{s.year ? ` · ${s.year}` : ""}{s.songKey ? ` · ${t("Key")} ${s.songKey}` : ""} · {t(licenseOf(s).label)}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="hint" style={{ marginTop: 32 }}>
        {COLLECTIONS.filter(c => c.slug !== collection.slug).map((c, i) => (
          <React.Fragment key={c.slug}>{i > 0 && " · "}<Link to={c.path}>{c.h1}</Link></React.Fragment>
        ))}
      </p>
    </main>
  );
};
