import { useEffect, useState } from "react";
import { loadSong, Song } from "./songs";

/** The song behind a /songs/:id route, plus the 404 the page renders when there isn't one. */
export function useSong(id: string | undefined) {
  const [song, setSong] = useState<Song | null>(null);
  const [notFound, setNotFound] = useState(false);
  useEffect(() => {
    if (!id) return;
    let stale = false;
    loadSong(id).then(s => { if (stale) return; if (s) setSong(s); else setNotFound(true); });
    return () => { stale = true; };
  }, [id]);
  return { song, notFound };
}
