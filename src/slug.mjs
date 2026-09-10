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

// ponytail: self-check — `node src/slug.mjs`
if (typeof process !== "undefined" && process.argv[1]?.endsWith("slug.mjs")) {
  const assert = (await import("node:assert")).default;
  assert.equal(songPath({ id: "fq-OAk1yMgA", title: "On What Has Now Been Sown" }), "/songs/on-what-has-now-been-sown-fq-OAk1yMgA");
  assert.equal(idOf("on-what-has-now-been-sown-fq-OAk1yMgA"), "fq-OAk1yMgA");
  assert.equal(idOf("fq-OAk1yMgA"), "fq-OAk1yMgA");
  assert.equal(idOf("John Newton"), "John Newton");
  assert.equal(writerPath("71c9ff4e9f8", "John Newton"), "/writers/john-newton-71c9ff4e9f8");
  assert.equal(idOf("john-newton-71c9ff4e9f8"), "71c9ff4e9f8");
  console.log("slug ok");
}
