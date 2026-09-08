import { useState } from "react";
import { Link } from "react-router-dom";
import type { Song } from "../songs";
import { attributionFor, LAYER_LABEL, layerLines, licenseHref, licenseOf, licenseUrl, licenseVersion, USE_LABEL } from "../licenses";
import { needsCcliReport, rightsMatrixFor, USES } from "../rights";
import { useI18n } from "../i18n";

const InfoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
);

// Can we use *this version* for our service? The deed (from the registry) says what the license allows in plain
// words; the matrix below composes every rights layer per use, so a PD text on a CC tune reads as the stricter one.
export default function RightsPanel({ song }: { song: Song }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const lic = licenseOf(song);
  const matrix = rightsMatrixFor(song);
  const layers = layerLines(song);
  const attribution = attributionFor(song);

  const copy = async () => {
    await navigator.clipboard.writeText(attribution);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className="rights-panel" data-testid="rights-panel">
      <h2>{t("Rights")}</h2>
      <div className="license-note">
        <InfoIcon />
        <div>
          <p data-testid="license-grant" data-license={lic.id}>
            {lic.id === "WC"
              ? <>© {song.year} {song.writer} · {t("WorshipCommons License v{version}", { version: licenseVersion(song) })}. {t("Shared through WorshipCommons — free for worship everywhere, always. Commercial use stays with the writer.")} <Link to="/license">{t("How that works")}</Link></>
              : lic.id === "PD"
                ? <>{t("Public domain. Free for every use, including commercial — no license needed.")} <Link to={licenseHref("PD")}>{t("How that works")}</Link></>
                : <>© {song.year} {song.writer} · <a href={licenseUrl(song)} target="_blank" rel="license noopener">{t("Creative Commons")} {lic.label} {licenseVersion(song)}</a>. {lic.nonCommercial ? t("Free for worship with credit — not for anything sold or monetized.") : lic.derivativesAllowed ? t("Free for every use, including commercial, as long as you credit the writer.") : t("Free to sing, print, project, and record as written, with credit — no arrangements, translations, or transposed charts may be shared.")} <Link to={licenseHref(lic.id)}>{t("How that works")}</Link></>}
          </p>
          {/* plain-language deed from the license registry — the legal code (linked above) controls */}
          {/* empty lists are omitted: public domain forbids nothing, so it gets the one list, full width */}
          <div className="may-grid">
            <ul className="may" data-testid="you-may" aria-label={t("You may")}>
              <li>{t("You may")}</li>
              {lic.may.map(k => <li key={k}>{t(k)}</li>)}
            </ul>
            {lic.mayNot.length > 0 && (
              <ul className="may-not" data-testid="you-may-not" aria-label={t("You may not")}>
                <li>{t("You may not")}</li>
                {lic.mayNot.map(k => <li key={k}>{t(k)}</li>)}
              </ul>
            )}
            {lic.must.length > 0 && (
              <ul className="must" data-testid="you-must" aria-label={t("You must")}>
                <li>{t("You must")}</li>
                {lic.must.map(k => <li key={k}>{t(k)}</li>)}
              </ul>
            )}
          </div>
        </div>
      </div>

      <table className="rights-matrix" data-testid="rights-matrix">
        <caption>{t("This version, use by use")}</caption>
        <tbody>
          {USES.map(u => (
            <tr key={u} data-testid={`rights-${u}`} data-allowed={matrix[u].allowed ? "true" : "false"}>
              <th scope="row">{t(USE_LABEL[u])}</th>
              <td className={matrix[u].allowed ? "ok" : "no"}>{matrix[u].allowed ? t("You may") : t("You may not")}</td>
              <td className="cond">{matrix[u].conditions.map(c => t(c)).join(" · ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="rel-hint" data-testid="ccli-line">
        {needsCcliReport(song)
          ? t("A US church reports project and print use of this song to CCLI.")
          : t("No CCLI report needed — every layer of this package is public domain, WorshipCommons, or Creative Commons.")}
      </p>

      {layers.length > 0 && (
        <ul className="rights-layers" data-testid="rights-layers">
          {layers.map(l => (
            <li key={l.layer} data-layer={l.layer}>
              <b>{t(LAYER_LABEL[l.layer])}</b> <span className="lic">{l.license}</span>
              {l.basis && <span className="basis">{l.basis}</span>}
            </li>
          ))}
        </ul>
      )}

      <div className="attribution">
        <pre data-testid="attribution-text">{attribution}</pre>
        <button type="button" className="btn btn-ghost copy-btn" data-testid="rights-copy-attribution" onClick={copy}>{copied ? t("Copied") : t("Copy attribution")}</button>
      </div>
    </section>
  );
}
