import { useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n";
import type { Song } from "../songs";
import { downloadFile, exportFreeShow, exportOpenLyrics, exportPptx, onSongText, type ExportItem } from "../exports";
import "../styles/project.css";

/** The Project mode of the song page: open the web projector, or take the slides to FreeShow / OpenLP / PowerPoint / OnSong. */
export default function ProjectPanel({ song, order, songKey }: { song: Song; order?: string[]; songKey?: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const item: ExportItem = { song, order, key: songKey };
  const query = order?.length ? `?order=${encodeURIComponent(order.join(","))}` : "";

  const copy = async () => {
    await navigator.clipboard.writeText(onSongText(item));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const status = song.form?.status;
  return (
    <div className="project-panel" data-testid="project-panel">
      <Link className="btn btn-primary" to={`/songs/${song.id}/project${query}`} data-testid="open-projector">{t("Open projector")}</Link>
      <div className="project-exports">
        <button type="button" className="btn btn-ghost" data-testid="export-freeshow" onClick={() => downloadFile(exportFreeShow([item]))}>{t("Download for FreeShow")}</button>
        <button type="button" className="btn btn-ghost" data-testid="export-openlyrics" onClick={() => downloadFile(exportOpenLyrics([item]))}>{t("Download OpenLyrics (OpenLP)")}</button>
        <button type="button" className="btn btn-ghost" data-testid="export-pptx" onClick={() => downloadFile(exportPptx([item]))}>{t("Download PPTX")}</button>
        <button type="button" className="btn btn-ghost" data-testid="export-onsong" onClick={copy}>{copied ? t("Copied ✓") : t("Copy for OnSong / Planning Center")}</button>
      </div>
      <p className="hint project-note" data-testid="project-note">
        {status
          ? t("Slides follow the song’s form map ({status}).", { status: status === "approved" ? t("approved") : t("draft") })
          : t("No form map yet — slides follow the stanzas as written.")}
        {" "}{t("Every export carries the attribution and license credit.")}
      </p>
    </div>
  );
}
