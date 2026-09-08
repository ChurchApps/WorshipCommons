import { useI18n } from "../i18n";
import type { Song } from "../songs";
import { CONFIDENCE_HELP, isDerivedScore } from "./ConfidenceBadge";

const WarnIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3 2 20h20L12 3z" /><path d="M12 10v4M12 17h.01" /></svg>
);

// A machine-derived score gets its own chrome on the song and sheet pages: one honest line, never Sunday-ready styling.
export default function DerivedBanner({ song }: { song: Pick<Song, "confidence" | "scoreSource"> }) {
  const { t } = useI18n();
  if (!isDerivedScore(song.confidence)) return null;
  const c = song.confidence!;
  return (
    <div className="derived-banner" data-testid="derived-banner" data-confidence={c} role="note">
      <WarnIcon />
      <span>{t(CONFIDENCE_HELP[c])} — {t("check the notes against a hymnal before Sunday.")}</span>
    </div>
  );
}
