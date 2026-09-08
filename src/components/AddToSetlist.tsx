import { useI18n } from "../i18n";
import type { Song } from "../songs";

// ponytail: stub — feat/site-setlists replaces this with the real picker; the hero keeps its sticky slot meanwhile
export default function AddToSetlist({ song }: { song: Song }) {
  const { t } = useI18n();
  return <button type="button" className="btn btn-primary" data-testid="add-to-setlist" data-song={song.id} disabled title={t("Setlists are coming soon")}>{t("+ Add to setlist")}</button>;
}
