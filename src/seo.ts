import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { canonicalPath, indexablePath } from "./crawl.mjs";

export function usePageMeta(title: string, description?: string) {
  useEffect(() => {
    document.title = title;
    if (description) document.querySelector('meta[name="description"]')?.setAttribute("content", description);
  }, [title, description]);
}

function upsertMeta(name: string, content: string) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string | null) {
  let el = document.querySelector(`link[rel="${rel}"]`);
  if (!href) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function upsertProperty(property: string, content: string | null) {
  let el = document.querySelector(`meta[property="${property}"]`);
  if (!content) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

// Google renders JS, and client navigations reuse one document. A song
// canonical left in <head> would otherwise follow the reader onto an
// account page, and an un-prerendered song would keep the homepage canonical
// that ships in the SPA fallback.
export function useCrawlPolicy() {
  const { pathname } = useLocation();
  useEffect(() => {
    const indexable = indexablePath(pathname);
    upsertMeta("robots", indexable ? "index, follow" : "noindex, follow");
    const canonical = indexable ? `${window.location.origin}${canonicalPath(pathname)}` : null;
    upsertLink("canonical", canonical);
    upsertProperty("og:url", canonical);
  }, [pathname]);
}
