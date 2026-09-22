// Prod viewer-request function. One hop to https://worshipcommons.org/<path>/.
// Attached only to the prod distribution: the host is hardcoded, so it must
// not run on staging. CloudFront does not cache a viewer-request response.
// The runtime requires the entry point to be named handler.
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
