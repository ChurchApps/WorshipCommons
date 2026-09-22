// Idempotent prod CloudFront viewer-request: 301 www and extensionless paths
// to https://worshipcommons.org/<path>/. The function hardcodes the apex host,
// so pass only the prod distribution id.
// Usage: node tools/ensure-apex-redirect.mjs <distribution-id>
import { execFileSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { fileURLToPath } from "url";

const NAME = "worshipcommons-apex-redirect";
const CODE = fs.readFileSync(fileURLToPath(new URL("./cloudfront/apex-redirect.js", import.meta.url)));
const CONFIG = { Comment: "301 www and extensionless paths to the worshipcommons.org trailing-slash URL", Runtime: "cloudfront-js-2.0" };

const cliFile = (file) => "file://" + file.replace(/\\/g, "/");

function aws(args, opts = {}) {
  return execFileSync("aws", args, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"], ...opts });
}

function fileb(buf) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cf-fn-"));
  const file = path.join(dir, "function.js");
  fs.writeFileSync(file, buf);
  return { dir, arg: "fileb://" + file.replace(/\\/g, "/") };
}

function describe(stage) {
  try {
    return JSON.parse(aws([
      "cloudfront", "describe-function", "--name", NAME, "--stage", stage, "--output", "json"
    ]));
  } catch (err) {
    if (/NoSuchFunctionExists|ResourceNotFound/i.test(String(err.stderr || err.message))) return null;
    throw err;
  }
}

function publishedCode() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cf-get-"));
  const file = path.join(dir, "live.js");
  try {
    aws(["cloudfront", "get-function", "--name", NAME, "--stage", "LIVE", file]);
    return fs.readFileSync(file);
  } catch {
    return null;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function publishLive() {
  let dev = describe("DEVELOPMENT");
  const code = fileb(CODE);
  try {
    if (!dev) {
      const created = JSON.parse(aws([
        "cloudfront",
        "create-function",
        "--name",
        NAME,
        "--function-config",
        JSON.stringify(CONFIG),
        "--function-code",
        code.arg,
        "--output",
        "json"
      ]));
      dev = { ETag: created.ETag };
    } else if (!publishedCode() || !publishedCode().equals(CODE)) {
      const updated = JSON.parse(aws([
        "cloudfront",
        "update-function",
        "--name",
        NAME,
        "--if-match",
        dev.ETag,
        "--function-config",
        JSON.stringify(CONFIG),
        "--function-code",
        code.arg,
        "--output",
        "json"
      ]));
      dev = { ETag: updated.ETag };
    }
  } finally {
    fs.rmSync(code.dir, { recursive: true, force: true });
  }
  const live = describe("LIVE");
  const liveCode = publishedCode();
  if (live && liveCode && liveCode.equals(CODE)) return live.FunctionSummary.FunctionMetadata.FunctionARN;
  smoke(dev.ETag);
  const published = JSON.parse(aws([
    "cloudfront", "publish-function", "--name", NAME, "--if-match", dev.ETag, "--output", "json"
  ]));
  return published.FunctionSummary.FunctionMetadata.FunctionARN;
}

function smoke(etag) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cf-test-"));
  const event = path.join(dir, "event.json");
  const body = {
    version: "1.0",
    context: {
      distributionDomainName: "d2go4bgy698jd.cloudfront.net",
      distributionId: "E363E9V6GH4TVJ",
      eventType: "viewer-request",
      requestId: "seo-smoke"
    },
    viewer: { ip: "198.51.100.11" },
    request: {
      method: "GET",
      uri: "/",
      querystring: {},
      headers: { host: { value: "www.worshipcommons.org" } },
      cookies: {}
    }
  };
  fs.writeFileSync(event, JSON.stringify(body));
  try {
    const out = JSON.parse(aws([
      "cloudfront",
      "test-function",
      "--name",
      NAME,
      "--stage",
      "DEVELOPMENT",
      "--if-match",
      etag,
      "--event-object",
      "fileb://" + event.replace(/\\/g, "/"),
      "--output",
      "json"
    ]));
    const result = out.TestResult || {};
    if (result.FunctionErrorMessage) throw new Error(result.FunctionErrorMessage);
    const generated = JSON.parse(result.FunctionOutput);
    const location = generated.response && generated.response.headers && generated.response.headers.location && generated.response.headers.location.value;
    if (generated.response?.statusCode !== 301 || location !== "https://worshipcommons.org/") {
      throw new Error("apex redirect smoke test failed: " + result.FunctionOutput);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function associate(id, arn) {
  const data = JSON.parse(aws(["cloudfront", "get-distribution-config", "--id", id, "--output", "json"]));
  const behavior = data.DistributionConfig.DefaultCacheBehavior;
  const items = behavior.FunctionAssociations?.Items || [];
  const wanted = { FunctionARN: arn, EventType: "viewer-request" };
  if (items.some(item => item.FunctionARN === arn && item.EventType === "viewer-request")) {
    console.log(`CloudFront ${id}: ${NAME} already on viewer-request`);
    return;
  }
  const next = [...items.filter(item => item.EventType !== "viewer-request"), wanted];
  behavior.FunctionAssociations = { Quantity: next.length, Items: next };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cf-dist-"));
  const cfg = path.join(dir, "config.json");
  fs.writeFileSync(cfg, JSON.stringify(data.DistributionConfig));
  try {
    aws([
      "cloudfront",
      "update-distribution",
      "--id",
      id,
      "--if-match",
      data.ETag,
      "--distribution-config",
      cliFile(cfg),
      "--output",
      "json"
    ]);
    console.log(`CloudFront ${id}: attached ${NAME}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function run(id) {
  if (!id) {
    console.error("usage: node tools/ensure-apex-redirect.mjs <distribution-id>");
    process.exit(1);
  }
  const arn = publishLive();
  associate(id, arn);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { run(process.argv[2]); } catch (err) { console.error("ensure-apex-redirect failed:", err.stderr || err.message || err); process.exit(1); }
}
