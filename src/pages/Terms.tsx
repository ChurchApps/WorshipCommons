import React, { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { usePageMeta } from "../seo";
import { useI18n } from "../i18n";

interface CardProps {
  title: string;
  id?: string;
  testId?: string;
  children: React.ReactNode;
}

const Card: React.FC<CardProps> = (props) => (
  <section className="card terms-card" id={props.id} data-testid={props.testId}>
    <h2>{props.title}</h2>
    {props.children}
  </section>
);

export const Terms: React.FC = () => {
  const { t } = useI18n();
  usePageMeta(t("Terms — WorshipCommons"));
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.querySelector(hash)?.scrollIntoView();
  }, [hash]);

  return (
    <main className="wrap-narrow">
      <div className="page-head">
        <span className="eyebrow">{t("Terms")}</span>
        <h1>{t("How this site works")}</h1>
        <p className="lede">{t("Short terms for using WorshipCommons. The license on a song is the grant — these terms don’t replace it.")}</p>
      </div>

      <Card title={t("Account")}>
        <p>{t("Accounts are provided by ChurchApps. One free account lets you share songs, save a library, and track submissions. You’re responsible for what you upload and for keeping your sign-in to yourself.")}</p>
      </Card>

      <Card title={t("The license is the grant")}>
        <p>{t("When you share a song, the license you choose is the legal grant — the license named on the song: WorshipCommons License, CC BY, or a CC0 public-domain dedication. Read about them on the")} <Link to="/license">{t("license page")}</Link>. {t("These site terms don’t rewrite that grant.")}</p>
      </Card>

      <Card title={t("Written by people")} id="ai">
        <p>{t("Words and melodies must be written by a person. AI-generated lyrics or tunes are not accepted and will be taken down when reported. Using AI tools to make a recording of a song a person wrote is fine. Each account can share 20 songs; if you have more, email us and we’ll raise the limit.")}</p>
      </Card>

      <Card title={t("Reporting")}>
        <p>{t("The commons runs on the promise that whoever shares a song actually owns it. If a song wasn’t theirs to share — especially if it’s yours —")} <Link to="/report">{t("report it")}</Link>. {t("We’ll look into it and aim to take reported material down within 48 hours when the claim holds.")}</p>
      </Card>

      <Card title={t("Copyright / DMCA")} id="copyright" testId="dmca-section">
        <p>{t("If a song here infringes your copyright, send a takedown notice. The fastest route is the")} <Link to="/report">{t("report form")}</Link> {t("— it asks for everything a notice needs under 17 U.S.C. § 512(c)(3): what you own, where it is on this site, how to reach you, a good-faith statement, and your signature. We aim to take reported material down within 48 hours when the claim holds.")}</p>
        <p>{t("You can also write to our designated copyright agent:")}<br />
          Micheal Byrd<br />
          LIVE CHURCH SOLUTIONS INC<br />
          PO Box 1553<br />
          Broken Arrow, OK 74013<br />
          {t("Phone:")} 918-994-2638<br />
          {t("Email:")}{" "}<a href="mailto:micheal@livechurchsolutions.org" data-testid="dmca-agent-email">micheal@livechurchsolutions.org</a></p>
        <p data-testid="dmca-registration">{t("The designated-agent registration is DMCA-1080721, under LIVE CHURCH SOLUTIONS INC.")}</p>
        <p>{t("If we take your material down and you believe that was a mistake, reply to the takedown email with a counter-notice. Under 17 U.S.C. § 512(g) it needs your signature, the material and where it was, a statement under penalty of perjury that it came down by mistake or misidentification, and your name, address, phone number, and consent to the jurisdiction of the federal court for your district (or, if you are outside the United States, any district where we may be found).")}</p>
        <p>{t("Accounts that repeatedly share songs they do not have the right to share are closed.")}</p>
      </Card>

      <Card title={t("No warranty")}>
        <p>{t("WorshipCommons is provided as-is. Charts, files, and metadata are offered without warranty, as far as the law allows. The songs belong to their writers; we host what they shared.")}</p>
      </Card>

      <Card title={t("Privacy")}>
        <p>{t("Account and personal data are handled by ChurchApps.")}{" "}<a href="https://churchapps.org/privacy">{t("Read the ChurchApps privacy policy.")}</a></p>
      </Card>
    </main>
  );
};
