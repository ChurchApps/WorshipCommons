import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";

export interface WriterLink { label?: string; url: string }

export const parseWriterLinks = (raw: unknown): WriterLink[] =>
  Array.isArray(raw) ? raw.filter((l: WriterLink) => typeof l?.url === "string" && l.url.trim()) : [];

export const linkLabel = (link: WriterLink) => {
  if (link.label) return link.label;
  try { return new URL(link.url).hostname.replace(/^www\./, ""); } catch { return link.url; }
};

const Chevron = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
);

export default function SupportWriter({ links, writer }: { links: WriterLink[]; writer?: string }) {
  const { t } = useI18n();
  const items = links.filter(l => l.url);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  if (items.length === 0) return null;

  if (items.length === 1) {
    return (
      <a className="btn btn-ghost btn-block" data-testid="support-writer" href={items[0].url} target="_blank" rel="noopener noreferrer nofollow">
        {t("Support the writer")}
      </a>
    );
  }

  return (
    <div className="support-picker" ref={box}>
      <button type="button" className="btn btn-ghost btn-block" data-testid="support-writer" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(v => !v)}>
        {t("Support the writer")}
        <Chevron />
      </button>
      {open && (
        <div className="support-menu" role="menu" aria-label={writer ? t("Ways to support {writer}", { writer }) : t("Support the writer")} data-testid="support-menu">
          {items.map(l => (
            <a key={l.url} role="menuitem" data-testid="support-option" href={l.url} target="_blank" rel="noopener noreferrer nofollow" onClick={() => setOpen(false)}>
              {linkLabel(l)}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
