const KEY = "wcLibrary";

export const libraryIds = (): string[] => {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
};

export const inLibrary = (id: string) => libraryIds().includes(id);

export const toggleLibrary = (id: string): boolean => {
  const ids = libraryIds();
  const next = ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id];
  localStorage.setItem(KEY, JSON.stringify(next));
  return next.includes(id);
};
