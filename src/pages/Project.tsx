import { Link, useParams } from "react-router-dom";
import { useI18n } from "../i18n";

// ponytail: stub — feat/site-project-exports replaces this with the lyrics-only projector
export default function Project() {
  const { id } = useParams();
  const { t } = useI18n();
  return (
    <main className="wrap" data-testid="projector">
      <p className="crumb" style={{ padding: "60px 0" }}>{t("Project lyrics")} · <Link to={`/songs/${id}`}>{t("← Back to song")}</Link></p>
    </main>
  );
}
