import { wcDelete, wcGet, wcPost } from "./api";

let cache: Promise<string[]> | null = null;

// the endpoint returns full song objects; the site only needs ids
export const libraryIds = (): Promise<string[]> => {
  if (!cache) cache = wcGet("/songs/library", true).then((songs: { id: string }[]) => (songs || []).map(s => s.id)).catch(() => [] as string[]);
  return cache;
};

export const clearLibraryCache = () => { cache = null; };

export const setInLibrary = async (id: string, add: boolean): Promise<void> => {
  if (add) await wcPost(`/songs/${id}/library`, {}, true); else await wcDelete(`/songs/${id}/library`, true);
  const current = await libraryIds();
  cache = Promise.resolve(add ? [id, ...current.filter(i => i !== id)] : current.filter(i => i !== id));
};
