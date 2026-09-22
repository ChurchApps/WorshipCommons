import React from "react";
import { useI18n } from "../i18n";
import type { License } from "../licenses";

interface Props {
  license: License;
}

// One badge per license: PD → "Public domain", WC → "WC" (title: Free for worship), Creative Commons → the flavour
// label; non-commercial ones a distinct colour so they can never pass for free-for-worship. data-license is what
// the specs read — keep it.
export const LicenseBadge: React.FC<Props> = (props) => {
  const { t } = useI18n();
  if (props.license.id === "WC") return <span className="free-badge" data-testid="license-badge" data-license="WC" title={t("Free for worship")}>WC</span>;
  if (props.license.id === "PD") return <span className="pd-badge" data-testid="license-badge" data-license="PD">{t("Public domain")}</span>;
  if (props.license.custom || props.license.listed === false) {
    return (
      <span className="custom-badge" data-testid="license-badge" data-license={props.license.id} title={props.license.label}>
        {t("Custom")}
      </span>
    );
  }
  return (
    <span className={"cc-badge" + (props.license.nonCommercial ? " nc" : "")} data-testid="license-badge" data-license={props.license.id} title={props.license.nonCommercial ? t("Non-commercial: credit required, nothing sold or monetized") : t("Credit required")}>
      {props.license.label}
    </span>
  );
};
