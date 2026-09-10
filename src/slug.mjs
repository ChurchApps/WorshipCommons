// SEO paths, shared by the React app and tools/prerender.mjs.
// /songs/<slug>-<id> mirrors the content bucket's folder names; ids are always 11 chars,
// so idOf() peels the slug back off and bare-id links keep working.
export const folderSlug = (title) => String(title || "").normalize("NFC").toLowerCase()
  .replace(/['\u2019\u02BC]/g, "")
  .replace(/[^a-z0-9\u00c0-\u024f]+/g, "-")
  .replace(/^-+|-+$/g, "") || "untitled";

export const idOf = (param = "") => param.length > 12 && param[param.length - 12] === "-" ? param.slice(-11) : param;
export const songPath = (song) => `/songs/${folderSlug(song.title)}-${song.id}`;
export const writerPath = (id, name) => `/writers/${folderSlug(name)}-${id}`;
