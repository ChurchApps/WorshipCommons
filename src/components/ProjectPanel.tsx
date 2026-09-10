import { useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n";
import { songPath, type Song } from "../songs";
import { downloadFile, exportFreeShow, exportOpenLyrics, exportPptx, onSongText, type ExportItem } from "../exports";
import "../styles/project.css";

const ScreenIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="2" y="4" width="20" height="14" rx="2" /><path d="M8 22h8" /></svg>;
const SlidesIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="5" width="18" height="12" rx="2" /><path d="M8 21h8" /></svg>;
const FileIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>;
const CopyIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>;

/** The Projection card of the song page: open the web projector, or take the slides to FreeShow / OpenLP / PowerPoint / OnSong. */
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
      <div className="proj">
        <Link to={`${songPath(song)}/project${query}`} data-testid="open-projector"><ScreenIcon />{t("Open projector")}</Link>
        <button type="button" data-testid="export-freeshow" title={t("Download for FreeShow")} onClick={() => downloadFile(exportFreeShow([item]))}><SlidesIcon />FreeShow</button>
        <button type="button" data-testid="export-pptx" title={t("Download PPTX")} onClick={() => downloadFile(exportPptx([item]))}><FileIcon />PowerPoint</button>
        <button type="button" data-testid="export-openlyrics" title={t("Download OpenLyrics (OpenLP)")} onClick={() => downloadFile(exportOpenLyrics([item]))}><SlidesIcon />OpenLP</button>
        <button type="button" data-testid="export-onsong" title={t("Copy for OnSong / Planning Center")} onClick={copy}><CopyIcon />{copied ? t("Copied ✓") : t("OnSong / PCO")}</button>
      </div>
      <p className="project-note" data-testid="project-note">
        {status
          ? t("Slides follow the song’s form map ({status}).", { status: status === "approved" ? t("approved") : t("draft") })
          : t("No form map yet — slides follow the stanzas as written.")}
        {" "}{t("Every export carries the attribution and license credit.")}
      </p>
    </div>
  );
}
