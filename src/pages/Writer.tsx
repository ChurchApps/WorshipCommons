import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { loadSongs, Song, songFromApi, themeList } from "../songs";
import { wcGet } from "../api";
import { usePageMeta } from "../seo";
import { useI18n } from "../i18n";
import { licenseOf } from "../licenses";

export interface WriterLink { label?: string; url: string }

interface Profile {
  name: string;
  bio?: string;
  portraitUrl?: string;
  links: WriterLink[];
}

const matchesWriter = (song: Song, q: string) => {
  const writer = (song.writer || "").toLowerCase();
  if (writer === q) return true;
  return writer.split(/[,&;]| and /i).map(p => p.trim()).includes(q);
};

// A label is optional on a saved link — fall back to the host so the anchor is never blank.
const linkLabel = (link: WriterLink) => {
  if (link.label) return link.label;
  try { return new URL(link.url).hostname.replace(/^www\./, ""); } catch { return link.url; }
};

export default function Writer() {
  const { t } = useI18n();
  const { name = "" } = useParams();
  const query = decodeURIComponent(name).trim();
  const [profile, setProfile] = useState<Profile>({ name: query, links: [] });
  const [songs, setSongs] = useState<Song[] | null>(null);

  usePageMeta(profile.name ? t("{writer} — WorshipCommons", { writer: profile.name }) : "WorshipCommons");

  useEffect(() => {
    let live = true;
    const q = query.toLowerCase();
    const fromCatalog = (all: Song[]) => all.filter(s => matchesWriter(s, q) || s.authorId === query || s.writerId === query);

    loadSongs().then(async all => {
      try {
        const raw = await wcGet(`/authors/${encodeURIComponent(query)}`);
        if (!live) return;
        const listed: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.songs) ? raw.songs : [];
        setProfile({
          name: raw?.name || raw?.writer || query,
          bio: raw?.bio || undefined,
          portraitUrl: raw?.portraitUrl || undefined,
          links: Array.isArray(raw?.links) ? raw.links.filter((l: WriterLink) => l?.url) : []
        });
        if (listed.length && typeof listed[0] === "string") {
          const ids = new Set(listed);
          setSongs(all.filter(s => ids.has(s.id)));
        } else if (listed.length && typeof listed[0] === "object") {
          setSongs(listed.map(songFromApi));
        } else {
          setSongs(fromCatalog(all));
        }
      } catch {
        if (live) {
          setProfile({ name: query, links: [] });
          setSongs(fromCatalog(all));
        }
      }
    }).catch(() => { if (live) setSongs([]); });

    return () => { live = false; };
  }, [query]);

  return (
    <main className="wrap-narrow">
      <div className="page-head">
        <span className="eyebrow">{t("Writer")}</span>
        <h1>{profile.name || t("Writer")}</h1>
        <p className="lede">{t("Songs in the commons by this writer.")}</p>
      </div>

      {(profile.portraitUrl || profile.bio || profile.links.length > 0) && (
        <div className="card" style={{ padding: 24, marginBottom: 24 }} data-testid="writer-profile">
          <div className="writer-row">
            {profile.portraitUrl && <img className="writer-photo" src={profile.portraitUrl} alt={t("Portrait of {writer}", { writer: profile.name })} loading="lazy" data-testid="writer-portrait" />}
            <div>
              {profile.bio && <p className="writer-bio" data-testid="writer-bio">{profile.bio}</p>}
              {profile.links.length > 0 && (
                <p className="hint" style={{ marginTop: 10, marginBottom: 0, display: "flex", gap: 12, flexWrap: "wrap" }} data-testid="writer-links">
                  {profile.links.map(l => (
                    <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer nofollow">{linkLabel(l)}</a>
                  ))}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {!songs && <p>{t("Loading…")}</p>}
      {songs?.length === 0 && (
        <div className="card" style={{ padding: 32, textAlign: "center" }} data-testid="writer-empty">
          <p style={{ marginBottom: 16 }}>{t("No songs found")}</p>
          <Link to={`/songs?q=${encodeURIComponent(query)}`} className="btn btn-primary">{t("Search the library")}</Link>
        </div>
      )}
      <ul data-testid="writer-songs" style={{ listStyle: "none" }}>
        {songs?.map(s => (
          <li key={s.id} className="card" style={{ padding: 24, marginBottom: 16 }} data-testid="writer-song">
            <h3 style={{ marginBottom: 4 }}><Link to={`/songs/${s.id}`}>{s.title}</Link></h3>
            <p className="hint">{s.year}{s.songKey ? ` · ${t("Key")} ${s.songKey}` : ""}{themeList(s).length ? ` · ${themeList(s).slice(0, 3).join(", ")}` : ""}{` · ${t(licenseOf(s).label)}`}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
