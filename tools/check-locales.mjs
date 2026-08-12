// Key parity check: every locale must carry the same keys as es.ts (the reference).
// A mistyped key silently falls back to English, so nothing else catches it.
// Usage: node tools/check-locales.mjs
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "locales");
const keys = (f) => [...fs.readFileSync(path.join(dir, f), "utf8").matchAll(/^ {2}"((?:[^"\\]|\\.)*)":/gm)].map(m => m[1]);

const ref = keys("es.ts");
const dupes = ref.filter((k, i) => ref.indexOf(k) !== i);
if (dupes.length) console.log(`es.ts duplicate keys: ${dupes.join(" | ")}`);

let bad = dupes.length > 0;
for (const f of fs.readdirSync(dir).filter(f => f !== "es.ts")) {
  const got = new Set(keys(f));
  const missing = ref.filter(k => !got.has(k));
  const extra = [...got].filter(k => !ref.includes(k));
  if (missing.length || extra.length) {
    bad = true;
    console.log(`${f}: ${missing.length} missing, ${extra.length} extra`);
    missing.forEach(k => console.log(`  - ${k}`));
    extra.forEach(k => console.log(`  + ${k}`));
  } else {
    console.log(`${f}: ok (${got.size})`);
  }
}
process.exit(bad ? 1 : 0);
