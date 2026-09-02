import { Link } from "react-router-dom";
import { usePageMeta } from "../seo";
import { useI18n } from "../i18n";

export default function Terms() {
  const { t } = useI18n();
  usePageMeta(t("Terms — WorshipCommons"));

  return (
    <main className="wrap-narrow">
      <div className="page-head">
        <span className="eyebrow">{t("Terms")}</span>
        <h1>{t("How this site works")}</h1>
        <p className="lede">{t("Short terms for using WorshipCommons. The license on a song is the grant — these terms don’t replace it.")}</p>
      </div>

      <section className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: "1.25rem", marginBottom: 10 }}>{t("Account")}</h2>
        <p>{t("Accounts are provided by ChurchApps. One free account lets you share songs, save a library, and track submissions. You’re responsible for what you upload and for keeping your sign-in to yourself.")}</p>
      </section>

      <section className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: "1.25rem", marginBottom: 10 }}>{t("The license is the grant")}</h2>
        <p>{t("When you share a song, the license you choose — WorshipCommons License or CC0 public-domain dedication — is the legal grant. Read it on the")} <Link to="/license">{t("license page")}</Link>. {t("These site terms don’t rewrite that grant.")}</p>
      </section>

      <section className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: "1.25rem", marginBottom: 10 }}>{t("Reporting")}</h2>
        <p>{t("The commons runs on the promise that whoever shares a song actually owns it. If a song wasn’t theirs to share — especially if it’s yours —")} <Link to="/report">{t("report it")}</Link>. {t("We’ll look into it and take it down when the claim holds.")}</p>
      </section>

      <section className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: "1.25rem", marginBottom: 10 }}>{t("No warranty")}</h2>
        <p>{t("WorshipCommons is provided as-is. Charts, files, and metadata are offered without warranty, as far as the law allows. The songs belong to their writers; we host what they shared.")}</p>
      </section>

      <section className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: "1.25rem", marginBottom: 10 }}>{t("Privacy")}</h2>
        <p>{t("Account and personal data are handled by ChurchApps.")}{" "}<a href="https://churchapps.org/privacy">{t("Read the ChurchApps privacy policy.")}</a></p>
      </section>
    </main>
  );
}
