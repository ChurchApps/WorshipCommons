import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loadWebPassage, type Passage } from "../bible";
import { useI18n } from "../i18n";

export default function ScriptureConnection({ reference, songId }: { reference?: string; songId: string }) {
  const { t } = useI18n();
  const [passage, setPassage] = useState<Passage | null | undefined>(reference ? undefined : null);

  useEffect(() => {
    if (!reference) { setPassage(null); return; }
    let dead = false;
    setPassage(undefined);
    loadWebPassage(reference).then(p => { if (!dead) setPassage(p); });
    return () => { dead = true; };
  }, [reference]);

  return (
    <div className="col scripture">
      <h4>📖 {t("Scripture connection")}</h4>
      {!reference
        ? <p className="empty">{t("No scripture reference yet.")} <Link to={`/songs/${songId}/edit`}>{t("Propose one →")}</Link></p>
        : (
          <>
            <b>{reference}</b>
            {passage === undefined && <p className="empty">{t("Loading…")}</p>}
            {passage && (
              <>
                <p className="scripture-text" data-testid="scripture-text">{passage.text}</p>
                <p className="scripture-src">{t("World English Bible · public domain")}</p>
              </>
            )}
            {passage === null && <p className="empty">{t("Couldn’t load this passage.")}</p>}
          </>
        )}
    </div>
  );
}
