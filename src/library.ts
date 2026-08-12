import { wcDelete, wcGet, wcPost } from "./api";

let cache: Promise<string[]> | null = null;

export const libraryIds = (): Promise<string[]> => {
  if (!cache) cache = wcGet("/songs/library", true).catch(() => [] as string[]);
  return cache;
};

export const clearLibraryCache = () => { cache = null; };

// returns the song's updated churchCount when a save added one
export const setInLibrary = async (id: string, add: boolean): Promise<number | undefined> => {
  const resp = add ? await wcPost(`/songs/${id}/library`, {}, true) : await wcDelete(`/songs/${id}/library`, true);
  const current = await libraryIds();
  cache = Promise.resolve(add ? [id, ...current.filter(i => i !== id)] : current.filter(i => i !== id));
  return resp?.churchCount;
};
