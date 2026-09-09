export interface Passage {
  reference: string;
  text: string;
}

const cache = new Map<string, Passage | null>();

/** World English Bible (public domain) via bible-api.com, which defaults to WEB. */
export async function loadWebPassage(ref: string): Promise<Passage | null> {
  const key = ref.trim();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key) ?? null;
  try {
    const r = await fetch(`https://bible-api.com/${encodeURIComponent(key)}?translation=web`);
    if (!r.ok) { cache.set(key, null); return null; }
    const j = await r.json();
    const text = String(j.text || "").replace(/\s+/g, " ").trim();
    const passage = text ? { reference: String(j.reference || key), text } : null;
    cache.set(key, passage);
    return passage;
  } catch {
    cache.set(key, null);
    return null;
  }
}
