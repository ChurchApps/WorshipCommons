import test from "node:test";
import assert from "node:assert/strict";
import { INPUTS, OUTPUTS, unmet, enabledBy, isPassthrough } from "../src/pipeline.ts";

const out = id => OUTPUTS.find(o => o.id === id);

test("words alone build the floor and nothing that needs notes or audio", () => {
  const have = new Set(["words"]);
  assert.deepEqual(unmet(out("lyrics"), have), []);
  assert.deepEqual(unmet(out("chords"), have), [["chords"]]);
  assert.equal(unmet(out("lead"), have).length, 1);
});

test("a recording without its grant builds no pack", () => {
  assert.deepEqual(unmet(out("packs"), new Set(["recording"])), [["recordingGrant"]]);
  assert.deepEqual(unmet(out("packs"), new Set(["recording", "recordingGrant"])), []);
});

test("every input feeds an output and every need is a known input", () => {
  const ids = new Set(INPUTS.map(([id]) => id));
  for (const [id] of INPUTS) assert.ok(enabledBy(id).length, id);
  for (const o of OUTPUTS) for (const i of o.needs.flat()) assert.ok(ids.has(i), `${o.id}: ${i}`);
});

test("passthroughs are the as-given files, not the floor", () => {
  assert.deepEqual(OUTPUTS.filter(isPassthrough).map(o => o.id), ["sheetPdf", "video", "cover", "extras"]);
});
