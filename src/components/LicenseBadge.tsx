import { useI18n } from "../i18n";
import type { License } from "../licenses";

const GlobeIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>
);

// One badge per license. WC keeps its "Free" pill and PD its globe; Creative Commons rows get the
// cc-badge, and non-commercial ones a distinct colour so they can never pass for "free for worship".
export default function LicenseBadge({ license, onArt, compact }: { license: License; onArt?: boolean; compact?: boolean }) {
  const { t } = useI18n();
  if (license.id === "WC") return <span className="free-badge" data-testid="license-badge" data-license="WC">{t(compact ? "Free" : "Free for worship")}</span>;
  if (license.id === "PD") return <span className={"pd-badge" + (onArt ? " on-art" : "")} data-testid="license-badge" data-license="PD">{compact && <GlobeIcon />}{t("Public domain")}</span>;
  return (
    <span className={"cc-badge" + (license.nonCommercial ? " nc" : "") + (onArt ? " on-art" : "")} data-testid="license-badge" data-license={license.id} title={license.nonCommercial ? t("Non-commercial: credit required, nothing sold or monetized") : t("Credit required")}>
      {license.label}
    </span>
  );
}
