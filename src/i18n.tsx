import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { es } from "./es";

export type Lang = "en" | "es";

// song records store the language as an English word
export const SONG_LANG: Record<Lang, string> = { en: "English", es: "Spanish" };

const detect = (): Lang => {
  const saved = localStorage.getItem("wcLang");
  if (saved === "en" || saved === "es") return saved;
  return navigator.language?.toLowerCase().startsWith("es") ? "es" : "en";
};

type Vars = Record<string, string | number>;
const I18n = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (s: string, vars?: Vars) => string }>({
  lang: "en",
  setLang: () => { },
  t: s => s
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detect);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const setLang = (l: Lang) => { localStorage.setItem("wcLang", l); setLangState(l); };
  // ponytail: English source text is the key — a missing translation falls through to English
  const t = (s: string, vars?: Vars) => {
    const out = lang === "es" ? es[s] ?? s : s;
    return vars ? out.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? "")) : out;
  };

  return <I18n.Provider value={{ lang, setLang, t }}>{children}</I18n.Provider>;
}

export const useI18n = () => useContext(I18n);
