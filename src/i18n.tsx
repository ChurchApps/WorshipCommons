import { createContext, useContext, useEffect, useState, ReactNode } from "react";

// One UI language per language the catalog actually has songs in.
// `song` is the English word song rows store in their `language` column.
export const LANGS = {
  en: { label: "English", song: "English" },
  es: { label: "Español", song: "Spanish" },
  de: { label: "Deutsch", song: "German" },
  fr: { label: "Français", song: "French" },
  pt: { label: "Português", song: "Portuguese" },
  ru: { label: "Русский", song: "Russian" },
  hu: { label: "Magyar", song: "Hungarian" },
  sq: { label: "Shqip", song: "Albanian" },
  ml: { label: "മലയാളം", song: "Malayalam" }
};

export type Lang = keyof typeof LANGS;

export const SONG_LANG = Object.fromEntries(
  Object.entries(LANGS).map(([k, v]) => [k, v.song])
) as Record<Lang, string>;

// ponytail: one lazy chunk per language — English ships no dictionary at all
const dicts = import.meta.glob<{ default: Record<string, string> }>("./locales/*.ts");

const detect = (): Lang => {
  const saved = localStorage.getItem("wcLang");
  if (saved && saved in LANGS) return saved as Lang;
  const nav = navigator.language?.slice(0, 2).toLowerCase();
  return nav && nav in LANGS ? nav as Lang : "en";
};

type Vars = Record<string, string | number>;
const I18n = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (s: string, vars?: Vars) => string }>({
  lang: "en",
  setLang: () => { },
  t: s => s
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detect);
  const [dict, setDict] = useState<Record<string, string>>({});

  useEffect(() => {
    document.documentElement.lang = lang;
    const load = dicts[`./locales/${lang}.ts`];
    if (!load) { setDict({}); return; }
    let live = true;
    load().then(m => { if (live) setDict(m.default); });
    return () => { live = false; };
  }, [lang]);

  const setLang = (l: Lang) => { localStorage.setItem("wcLang", l); setLangState(l); };
  // ponytail: English source text is the key — a missing translation falls through to English
  const t = (s: string, vars?: Vars) => {
    const out = dict[s] ?? s;
    return vars ? out.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? "")) : out;
  };

  return <I18n.Provider value={{ lang, setLang, t }}>{children}</I18n.Provider>;
}

export const useI18n = () => useContext(I18n);
