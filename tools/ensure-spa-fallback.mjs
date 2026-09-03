// Idempotent CloudFront patch: 403 and 404 → /index.html with HTTP 200.
// S3 REST origins return 403 (not 404) for a missing key when the caller
// cannot ListBucket; website origins return 404. Either way the SPA needs
// the document so /songs/:id that are not in this prerender still boot.
// Usage: node tools/ensure-spa-fallback.mjs <distribution-id>
import { execFileSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { fileURLToPath, pathToFileURL } from "url";

export const SPA_ERROR_RESPONSES = [
  { ErrorCode: 403, ResponsePagePath: "/index.html", ResponseCode: "200", ErrorCachingMinTTL: 0 },
  { ErrorCode: 404, ResponsePagePath: "/index.html", ResponseCode: "200", ErrorCachingMinTTL: 0 }
];

const same = (a, b) => Number(a.ErrorCode) === Number(b.ErrorCode)
  && a.ResponsePagePath === b.ResponsePagePath
  && String(a.ResponseCode) === String(b.ResponseCode);

export function spaFallbackMissing(config) {
  const items = config?.CustomErrorResponses?.Items || [];
  return SPA_ERROR_RESPONSES.some(w => !items.some(i => same(i, w)));
}

export function withSpaFallback(config) {
  const items = [...(config.CustomErrorResponses?.Items || [])];
  for (const wanted of SPA_ERROR_RESPONSES) {
    const i = items.findIndex(x => Number(x.ErrorCode) === wanted.ErrorCode);
    if (i >= 0) items[i] = { ...items[i], ...wanted };
    else items.push(wanted);
  }
  return { ...config, CustomErrorResponses: { Quantity: items.length, Items: items } };
}

function aws(args, opts = {}) {
  return execFileSync("aws", args, { encoding: "utf8", ...opts });
}

function run(id) {
  if (!id) {
    console.error("usage: node tools/ensure-spa-fallback.mjs <distribution-id>");
    process.exit(1);
  }
  const data = JSON.parse(aws(["cloudfront", "get-distribution-config", "--id", id, "--output", "json"]));
  if (!spaFallbackMissing(data.DistributionConfig)) {
    console.log(`CloudFront ${id}: SPA 403/404 → /index.html already set`);
    return;
  }
  const cfg = withSpaFallback(data.DistributionConfig);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cf-spa-"));
  const cfgPath = path.join(tmp, "config.json");
  fs.writeFileSync(cfgPath, JSON.stringify(cfg));
  try {
    aws(["cloudfront", "update-distribution", "--id", id, "--if-match", data.ETag, "--distribution-config", pathToFileURL(cfgPath).href], { stdio: "inherit" });
    console.log(`CloudFront ${id}: set SPA 403/404 → /index.html 200`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { run(process.argv[2]); }
  catch (err) { console.error("ensure-spa-fallback failed:", err.message || err); process.exit(1); }
}
