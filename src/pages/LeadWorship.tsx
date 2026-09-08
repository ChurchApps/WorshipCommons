import { Link, useParams } from "react-router-dom";
import { useI18n } from "../i18n";

// ponytail: stub — feat/site-lead-worship replaces this with the full-screen player
export default function LeadWorship() {
  const { id } = useParams();
  const { t } = useI18n();
  return (
    <main className="wrap" data-testid="lead-worship">
      <p className="crumb" style={{ padding: "60px 0" }}>{t("Lead worship")} · <Link to={`/songs/${id}`}>{t("← Back to song")}</Link></p>
    </main>
  );
}
