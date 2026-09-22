import test from "node:test";
import assert from "node:assert/strict";
import { attachListMedia, contentRootFromApi } from "../src/listMedia.mjs";

test("content root follows the API host", () => {
  assert.equal(contentRootFromApi("https://api.churchapps.org"), "https://content.churchapps.org");
  assert.equal(contentRootFromApi("https://api.staging.churchapps.org"), "https://content.staging.churchapps.org");
  assert.equal(contentRootFromApi("http://localhost:8084"), "http://localhost:8084/content");
});

test("list media is built from the package directory and the parent", () => {
  const parent = {
    id: "song0000001",
    packageDir: "songs/en/jesus-lover-of-my-soul-song0000001",
    hasCover: true,
    hasMidi: true
  };
  const child = {
    id: "child0000001",
    parentSongId: "song0000001",
    packageDir: "songs/es/cariñoso-salvador-child0000001",
    hasCover: true,
    coverOnParent: true,
    hasMidi: true,
    hasDemo: true,
    hasStems: true,
    portrait: "writers/john-newton/portrait.jpg"
  };
  const detail = { id: "kept", artUrl: "https://cdn.example/already.webp", hasCover: true, packageDir: "songs/en/kept-kept00000001" };
  attachListMedia([parent, child, detail], "https://content.churchapps.org");

  assert.equal(parent.artUrl, "https://content.churchapps.org/songs/en/jesus-lover-of-my-soul-song0000001/sources/cover.webp");
  assert.equal(parent.thumbUrl, "https://content.churchapps.org/songs/en/jesus-lover-of-my-soul-song0000001/output/composition/cover-thumb.webp");
  assert.equal(child.artUrl, parent.artUrl);
  assert.equal(child.thumbUrl, parent.thumbUrl);
  assert.equal(child.midiUrl, "https://content.churchapps.org/songs/es/cariñoso-salvador-child0000001/sources/tune.mid");
  assert.equal(child.demoAudioUrl, "https://content.churchapps.org/songs/es/cariñoso-salvador-child0000001/sources/master/song.mp3");
  assert.equal(child.writerPortraitUrl, "https://content.churchapps.org/writers/john-newton/portrait.jpg");
  assert.equal(detail.artUrl, "https://cdn.example/already.webp");
});
