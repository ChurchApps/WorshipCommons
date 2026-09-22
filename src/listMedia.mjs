// The song list no longer carries cover, thumbnail, melody, or demo URLs.
// Those files have fixed names. packageDir is the commons-relative folder
// (not always slug of the current title). A translation sets coverOnParent
// or midiOnParent and the file lives in the parent's folder.

const COVER = "sources/cover.webp";
const THUMB = "output/composition/cover-thumb.webp";
const MIDI = "sources/tune.mid";
const DEMO = "sources/master/song.mp3";

export function contentRootFromApi(apiBase) {
  const api = String(apiBase || "").replace(/\/$/, "");
  if (!api || /localhost|127\.0\.0\.1/.test(api)) {
    const base = api || "http://localhost:8084";
    return base.endsWith("/content") ? base : `${base}/content`;
  }
  return api.replace("://api.", "://content.");
}

const baseOf = (song, root) => (song?.packageDir ? `${root}/commons/${song.packageDir}` : "");

/** Fill art, thumb, melody, demo, and portrait on list rows. Detail rows already have URLs. */
export function attachListMedia(songs, contentRoot) {
  const byId = new Map(songs.map(song => [song.id, song]));
  for (const song of songs) {
    if (!song.writerPortraitUrl && song.portrait) {
      song.writerPortraitUrl = song.portrait.startsWith("http") ? song.portrait : `${contentRoot}/commons/${song.portrait}`;
    }
    const own = baseOf(song, contentRoot);
    const parent = song.parentSongId ? byId.get(song.parentSongId) : undefined;
    const parentBase = baseOf(parent, contentRoot);
    const coverBase = song.coverOnParent ? parentBase : own;
    if (song.hasCover && coverBase && !song.artUrl) {
      song.artUrl = `${coverBase}/${COVER}`;
      song.thumbUrl = song.thumbUrl || `${coverBase}/${THUMB}`;
    }
    const midiBase = song.midiOnParent ? parentBase : own;
    if (song.hasMidi && midiBase && !song.midiUrl) song.midiUrl = `${midiBase}/${MIDI}`;
    if (song.hasDemo && own && !song.demoAudioUrl) song.demoAudioUrl = `${own}/${DEMO}`;
  }
  return songs;
}
