import { wcGet, wcPut } from "./api";

let cache: Promise<string[]> | null = null;

// the endpoint returns full asset objects; the site only needs ids
export const libraryIds = (): Promise<string[]> => {
  if (!cache) cache = wcGet("/assets/saved", true).then((assets: { id: string }[]) => (assets || []).map(a => a.id)).catch(() => [] as string[]);
  return cache;
};

export const clearLibraryCache = () => { cache = null; };

export const setInLibrary = async (id: string, add: boolean): Promise<void> => {
  await wcPut(`/assets/${id}/saved`, { saved: add }, true);
  const current = await libraryIds();
  cache = Promise.resolve(add ? [id, ...current.filter(i => i !== id)] : current.filter(i => i !== id));
};
