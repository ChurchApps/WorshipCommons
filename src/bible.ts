export interface Passage {
  reference: string;
  text: string;
}

const cache = new Map<string, Passage | null>();

/**
 * bible-api.com queries for a reference as writers type it: any dash becomes a hyphen ("Romans 8:15–16"), and a list
 * of passages splits where a comma or semicolon is followed by a book name ("Psalm 91:4, Isaiah 43:2") — bible-api takes
 * one book per query. A verse list within one chapter ("John 3:16,18") stays whole.
 */
export function passageQueries(ref: string): string[] {
  return ref.replace(/[‐-―−]/g, "-")
    .split(/\s*[,;]\s*(?=(?:\d\s*)?\p{L}{2,})/u)
    .map(s => s.trim())
    .filter(Boolean);
}

async function loadOne(query: string): Promise<Passage | null> {
  const r = await fetch(`https://bible-api.com/${encodeURIComponent(query)}?translation=web`);
  if (!r.ok) return null;
  const j = await r.json();
  const text = String(j.text || "").replace(/\s+/g, " ").trim();
  return text ? { reference: String(j.reference || query), text } : null;
}

/** World English Bible (public domain) via bible-api.com, which defaults to WEB. Several passages read in order. */
export async function loadWebPassage(ref: string): Promise<Passage | null> {
  const key = ref.trim();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key) ?? null;
  try {
    const found = (await Promise.all(passageQueries(key).map(loadOne))).filter((p): p is Passage => !!p);
    const passage = found.length ? { reference: found.map(p => p.reference).join("; "), text: found.map(p => p.text).join(" … ") } : null;
    cache.set(key, passage);
    return passage;
  } catch {
    cache.set(key, null);
    return null;
  }
}
