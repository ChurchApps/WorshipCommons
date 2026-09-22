import { useEffect, useState } from "react";
import { loadSong, Song } from "./songs";

/** The song behind a /songs/:id route. A 404 is notFound; a failed request is loadError. */
export function useSong(id: string | undefined) {
  const [song, setSong] = useState<Song | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!id) return;
    let stale = false;
    setNotFound(false);
    setLoadError(false);
    loadSong(id).then(s => {
      if (stale) return;
      if (s) setSong(s);
      else setNotFound(true);
    }).catch(() => { if (!stale) setLoadError(true); });
    return () => { stale = true; };
  }, [id, attempt]);
  return { song, notFound, loadError, retry: () => setAttempt(n => n + 1) };
}
