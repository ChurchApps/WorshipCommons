import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loadWebPassage, type Passage } from "../bible";
import { useI18n } from "../i18n";

interface Props {
  reference?: string;
  songId: string;
}

export const ScriptureConnection: React.FC<Props> = (props) => {
  const { t } = useI18n();
  const [passage, setPassage] = useState<Passage | null | undefined>(props.reference ? undefined : null);

  useEffect(() => {
    if (!props.reference) { setPassage(null); return; }
    let dead = false;
    setPassage(undefined);
    loadWebPassage(props.reference).then(p => { if (!dead) setPassage(p); });
    return () => { dead = true; };
  }, [props.reference]);

  return (
    <div className="col scripture">
      <h4>📖 {t("Scripture connection")}</h4>
      {!props.reference
        ? <p className="empty">{t("No scripture reference yet.")} <Link to={`/songs/${props.songId}/edit`}>{t("Propose one →")}</Link></p>
        : (
          <>
            <b>{props.reference}</b>
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
};
