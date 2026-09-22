import React, { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth";
import { useI18n, LANGS, Lang } from "../i18n";

export const LogoMark: React.FC = () => {
  return (
    <svg className="logo-mark" viewBox="300 300 1000 390" fill="none" aria-hidden="true">
      <g stroke="#B49AFF" strokeLinecap="round" strokeLinejoin="round">
        <path strokeWidth="34" d="M343 514 H378 C422 514 437 420 482 420 C532 420 559 601 609 601 C659 601 687 420 739 420 C789 420 817 601 867 601 C911 601 932 533 940 491" />
        <path strokeWidth="34" d="M1226 407 C1191 369 1147 347 1096 348 C1013 349 949 410 940 491 C931 575 997 648 1081 648 C1138 648 1188 625 1226 587" />
        <path strokeWidth="28" d="M998 531 C987 461 1040 401 1110 408" />
      </g>
    </svg>
  );
};

const LangToggle: React.FC = () => {
  const { lang, setLang } = useI18n();
  // ponytail: the native select stays — it just sits invisible over the globe + code face
  return (
    <span className="lang-picker">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18" /></svg>
      <b>{lang.toUpperCase()}</b>
      <select className="lang-toggle" aria-label="Site language" data-testid="lang-select"
        value={lang} onClick={e => e.stopPropagation()} onChange={e => setLang(e.target.value as Lang)}>
        {Object.entries(LANGS).map(([code, l]) => <option key={code} value={code}>{l.label}</option>)}
      </select>
    </span>
  );
};

export const Layout: React.FC = () => {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const { t } = useI18n();

  return (
    <>
      <header className="site-header">
        <nav className="nav wrap" aria-label="Main">
          <Link className="logo" to="/"><LogoMark /><span>worship commons</span></Link>
          <button className="nav-toggle" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}><span></span><span></span><span></span></button>
          <ul className={"nav-menu" + (open ? " open" : "")} onClick={() => setOpen(false)}>
            <li><NavLink to="/songs">{t("Discover")}</NavLink></li>
            <li><NavLink to="/setlists" data-testid="nav-setlists">{t("Service plans")}</NavLink></li>
            <li><NavLink to="/upload">{t("For Songwriters")}</NavLink></li>
            <li><NavLink to="/mission">{t("Our Mission")}</NavLink></li>
            <li className="nav-actions"><ul>
              <li><NavLink to="/library" data-testid="nav-library">{t("Saved songs")}</NavLink></li>
              <li className="split" aria-hidden="true"></li>
              {user
                ? (
                  <li>
                    <details className="nav-account">
                      <summary data-testid="nav-account" onClick={e => e.stopPropagation()}>{user.firstName}</summary>
                      <div className="nav-account-menu">
                        <NavLink to="/my-songs" data-testid="my-songs">{t("My submissions")}</NavLink>
                        <NavLink to="/report">{t("Report")}</NavLink>
                        <button type="button" className="nav-signout" data-testid="sign-out" onClick={logout}>{t("Sign out")}</button>
                      </div>
                    </details>
                  </li>
                )
                : <li><NavLink to="/login" className="nav-signin" data-testid="sign-in">{t("Sign in")}</NavLink></li>}
              <li><Link to="/songs" className="btn btn-primary">{t("Browse Songs")}</Link></li>
            </ul></li>
          </ul>
        </nav>
      </header>

      <Outlet />

      <footer className="site-footer">
        <div className="wrap">
          <div className="foot">
            <Link className="logo" to="/"><LogoMark /><span>worship commons</span></Link>
            <ul className="foot-links">
              <li><Link to="/songs">{t("Discover")}</Link></li>
              <li><Link to="/setlists">{t("Service plans")}</Link></li>
              <li><Link to="/upload">{t("For Songwriters")}</Link></li>
              <li><Link to="/mission">{t("Our Mission")}</Link></li>
            </ul>
            <p className="foot-tag">{t("For a church that sings.")}</p>
          </div>
          <p className="foot-legal">
            <Link to="/new">{t("New songs")}</Link>
            <Link to="/call-for-songs">{t("Call for songs")}</Link>
            <Link to="/report">{t("Report a song")}</Link>
            <Link to="/license">{t("The License")}</Link>
            <Link to="/license#faq">{t("Questions")}</Link>
            <Link to="/terms#copyright" data-testid="foot-dmca">{t("Copyright / DMCA")}</Link>
            <a href="https://churchapps.org/privacy">{t("Privacy")}</a>
            <Link to="/terms">{t("Terms")}</Link>
            <a href="https://churchapps.org" data-testid="foot-churchapps">{t("A service of ChurchApps")}</a>
            <LangToggle />
          </p>
        </div>
      </footer>
    </>
  );
};
