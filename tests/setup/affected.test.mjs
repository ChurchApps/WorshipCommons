import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./affected.mjs", import.meta.url));
const root = fileURLToPath(new URL("../..", import.meta.url));

const list = (files) => execFileSync(process.execPath, [script, "--files", files.join(","), "--list"], { cwd: root, encoding: "utf8" });
const specsOf = (out) => out.split("\n").map((l) => l.trim()).filter((l) => /^tests\/.*\.spec\.ts$/.test(l));

const assertNotFull = (out) => {
  assert.ok(!out.includes("full suite"), out);
  assert.ok(!out.includes("(all specs)"), out);
};

test("a PR screenshot alone runs only the always spec", () => {
  const out = list([".pr-screenshots/after.png"]);
  assertNotFull(out);
  assert.deepEqual(specsOf(out), ["tests/home.spec.ts"]);
});

test("a PR screenshot does not widen a real change to the full suite", () => {
  const out = list([".pr-screenshots/after.png", "src/pages/Home.tsx"]);
  assertNotFull(out);
  assert.ok(out.includes("src/pages/Home.tsx -> home"), out);
  const specs = specsOf(out);
  assert.ok(specs.includes("tests/home.spec.ts"), out);
  assert.ok(specs.includes("tests/catalog-load.spec.ts"), out);
});

test("a source file in no area still selects the full suite", () => {
  const out = list(["src/songs.ts"]);
  assert.ok(out.includes("full suite:"), out);
  assert.ok(out.includes("(all specs)"), out);
});

test("image files anywhere do not select the full suite", () => {
  for (const f of ["shot.png", "shot.jpg", "shot.jpeg", "shot.gif", "shot.webp"]) {
    assert.ok(!list([f]).includes("full suite"), f);
  }
});

test("an area source file selects its area, not the full suite", () => {
  assert.ok(!list(["src/pages/Home.tsx"]).includes("full suite"));
});

test("this test file is ignored, not treated as shared code", () => {
  assert.ok(!list(["tests/setup/affected.test.mjs"]).includes("full suite"));
});
