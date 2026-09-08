import { Link } from "react-router-dom";
import { useI18n } from "../i18n";
import type { Song } from "../songs";

// ponytail: stub — feat/site-project-exports replaces this with the projector link plus FreeShow / OpenLP / OpenLyrics / paste exports
export default function ProjectPanel({ song }: { song: Song }) {
  const { t } = useI18n();
  return (
    <div className="project-panel" data-testid="project-panel">
      <Link className="btn" to={`/songs/${song.id}/project`} data-testid="open-projector">{t("Project lyrics")}</Link>
    </div>
  );
}
