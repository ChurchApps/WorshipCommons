// Which URLs search engines should index. Account, utility, and print views are
// noindex so they are not stored as copies of the homepage (CloudFront serves
// index.html for any path that was not prerendered).

export const PUBLIC_PATHS = ["/new", "/mission", "/license", "/call-for-songs", "/report", "/terms", "/upload"];

// prefixes of routes that are private or per-browser
export const PRIVATE_PREFIXES = ["/login", "/library", "/my-songs", "/profile", "/setlists", "/preview"];

// song utility views that duplicate the song page
export const PRIVATE_SUFFIXES = ["/print", "/sheet", "/lead", "/project", "/edit", "/transcribe"];

const bare = (pathname) => {
  const path = String(pathname || "/").split("?")[0].split("#")[0];
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path || "/";
};

export function indexablePath(pathname) {
  const path = bare(pathname);
  if (PRIVATE_PREFIXES.some(prefix => path === prefix || path.startsWith(prefix + "/"))) return false;
  if (PRIVATE_SUFFIXES.some(suffix => path.endsWith(suffix))) return false;
  if (path === "/") return true;
  if (path === "/songs" || path.startsWith("/songs/")) return true;
  if (path.startsWith("/writers/") && path.length > "/writers/".length) return true;
  return PUBLIC_PATHS.includes(path);
}

// prerendered documents live at trailing-slash URLs
export function canonicalPath(pathname) {
  const path = bare(pathname);
  return path === "/" ? "/" : path + "/";
}
