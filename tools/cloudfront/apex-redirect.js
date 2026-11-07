// Prod viewer-request function. One hop to https://worshipcommons.org/<path>/,
// and a real 404 for paths that are no route of the site (the S3 fallback would
// otherwise answer them with a 200 page). Attached only to the prod distribution:
// the host is hardcoded, so it must not run on staging. CloudFront does not cache
// a viewer-request response. The runtime requires the entry point to be named handler.

// First path segments the SPA routes or the bucket serves (src/main.tsx, public/, build/).
// Keep in step with new top-level routes, or they will 404.
const SECTIONS = {
  "songs": 1,
  "writers": 1,
  "new": 1,
  "listen": 1,
  "upload": 1,
  "mission": 1,
  "license": 1,
  "call-for-songs": 1,
  "report": 1,
  "library": 1,
  "setlists": 1,
  "login": 1,
  "my-songs": 1,
  "profile": 1,
  "terms": 1,
  "preview": 1,
  "hymns": 1,
  "no-ccli": 1,
  "assets": 1,
  "og": 1,
  "soundfonts": 1,
  "mock": 1
};

function known(uri) {
  if (uri === "/" || uri === "/index.html") return true;
  const parts = uri.split("/");
  // a file at the root (sitemap.xml, favicon.svg, spa.html) is the bucket's to answer
  if (parts.length === 2 && parts[1].indexOf(".") !== -1) return true;
  return SECTIONS[parts[1]] === 1;
}

const NOT_FOUND = "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"robots\" content=\"noindex\">" +
  "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>Page not found — WorshipCommons</title></head>" +
  "<body style=\"font-family:system-ui,sans-serif;max-width:600px;margin:80px auto;padding:0 24px\"><h1>Page not found</h1>" +
  "<p>There is no page at this address.</p><p><a href=\"https://worshipcommons.org/songs/\">Browse the song library</a> · " +
  "<a href=\"https://worshipcommons.org/\">Home</a></p></body></html>";

function qs(request) {
  const q = request.querystring || {};
  const parts = [];
  for (const key in q) {
    const entry = q[key];
    const values = entry.multiValue || [entry];
    for (let i = 0; i < values.length; i++) {
      if (!values[i] || values[i].value === undefined || values[i].value === null) continue;
      parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(values[i].value));
    }
  }
  return parts.length ? "?" + parts.join("&") : "";
}

function handler(event) { // eslint-disable-line @typescript-eslint/no-unused-vars
  const request = event.request;
  const hostHeader = request.headers && request.headers.host;
  const host = hostHeader && hostHeader.value ? hostHeader.value.toLowerCase() : "";
  let uri = request.uri || "/";
  if (!known(uri)) {
    return {
      statusCode: 404,
      statusDescription: "Not Found",
      headers: { "content-type": { value: "text/html; charset=utf-8" }, "cache-control": { value: "no-store" } },
      body: { encoding: "text", data: NOT_FOUND }
    };
  }
  let changed = host === "www.worshipcommons.org";
  if (uri === "/index.html") {
    uri = "/";
    changed = true;
  }
  const leaf = uri.slice(uri.lastIndexOf("/") + 1);
  if (uri !== "/" && uri.charAt(uri.length - 1) !== "/" && leaf.indexOf(".") === -1) {
    uri += "/";
    changed = true;
  }
  if (!changed) return request;
  return {
    statusCode: 301,
    statusDescription: "Moved Permanently",
    headers: { location: { value: "https://worshipcommons.org" + uri + qs(request) } }
  };
}
