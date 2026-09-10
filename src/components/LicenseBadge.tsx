import { useI18n } from "../i18n";
import type { License } from "../licenses";

// One badge per license: PD → "Public domain", WC → "WC" (title: Free for worship), Creative Commons → the flavour
// label; non-commercial ones a distinct colour so they can never pass for free-for-worship. data-license is what
// the specs read — keep it.
export default function LicenseBadge({ license }: { license: License }) {
  const { t } = useI18n();
  if (license.id === "WC") return <span className="free-badge" data-testid="license-badge" data-license="WC" title={t("Free for worship")}>WC</span>;
  if (license.id === "PD") return <span className="pd-badge" data-testid="license-badge" data-license="PD">{t("Public domain")}</span>;
  return (
    <span className={"cc-badge" + (license.nonCommercial ? " nc" : "")} data-testid="license-badge" data-license={license.id} title={license.nonCommercial ? t("Non-commercial: credit required, nothing sold or monetized") : t("Credit required")}>
      {license.label}
    </span>
  );
}
