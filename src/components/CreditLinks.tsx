import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { catalogPersons, creditParts } from "../credits.mjs";
import { loadSongs, Song, writerPath } from "../songs";

type Persons = ReturnType<typeof catalogPersons>;

let persons: Persons | null = null;
let personsFor: Song[] | null = null;

/** Writer pages per person for the whole catalog, computed once per catalog load. */
export async function loadPersons(): Promise<Persons> {
  const all = await loadSongs();
  if (personsFor !== all) {
    persons = catalogPersons(all);
    personsFor = all;
  }
  return persons;
}

/** Fallback when a credit names no person ("Traditional"): the credit's own page, else a library search. */
const creditHref = (song: Song) => song.authorId || song.writerId
  ? writerPath(song.authorId || song.writerId || "", song.writer)
  : `/songs?q=${encodeURIComponent(song.writer)}`;

/** The credit as written, each person linked to their own writer page. */
export const CreditLinks: React.FC<{ song: Song; bold?: boolean }> = (props) => {
  const [known, setKnown] = useState<Persons | null>(persons);
  useEffect(() => {
    let live = true;
    loadPersons().then(p => { if (live) setKnown(p); }).catch(() => {});
    return () => { live = false; };
  }, []);

  const parts = creditParts(props.song.writer, known || undefined);
  const wrap = (node: React.ReactNode) => props.bold ? <b>{node}</b> : node;
  if (!parts.some(p => p.person)) return <Link to={creditHref(props.song)} data-testid="writer-link">{wrap(props.song.writer)}</Link>;
  return (
    <span data-testid="writer-credit">
      {parts.map((p, i) => p.person
        ? <Link key={i} to={p.person.path} data-testid="writer-link">{wrap(p.text)}</Link>
        : <React.Fragment key={i}>{p.text}</React.Fragment>)}
    </span>
  );
};
