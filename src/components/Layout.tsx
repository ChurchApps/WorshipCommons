import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth";
import { useI18n, LANGS, Lang } from "../i18n";

function LogoMark() {
  return (
    <svg className="logo-mark" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="wcg" x1="0" y1="0" x2="64" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6C2BD9" />
          <stop offset="1" stopColor="#FF6B4A" />
        </linearGradient>
      </defs>
      <path d="M50.4 20A22 22 0 1 0 50.4 44" stroke="currentColor" strokeWidth="12" strokeLinecap="round" fill="none" />
      <path d="M14.6 25.7A18.5 18.5 0 0 1 28.8 13.8" stroke="rgba(255,255,255,0.4)" strokeWidth="1.6" fill="none" />
      <path d="M8.9 21.2A25.5 25.5 0 0 1 25.4 7.4" stroke="rgba(255,255,255,0.4)" strokeWidth="1.6" fill="none" />
      <path d="M17 32q3-9 6 0q3 22 6 0q3-13 6 0q3 22 6 0q3-9 6 0" stroke="url(#wcg)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <circle cx="50.4" cy="44" r="5" fill="#D9F154" />
    </svg>
  );
}

function LangToggle() {
  const { lang, setLang } = useI18n();
  // ponytail: the native select stays — it just sits invisible over the globe + code face
  return (
    <span className="lang-picker">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18" /></svg>
      <b>{lang.toUpperCase()}</b>
      {/* stopPropagation keeps the mobile menu from closing (display:none) under the open picker */}
      <select className="lang-toggle" aria-label="Site language" data-testid="lang-select"
        value={lang} onClick={e => e.stopPropagation()} onChange={e => setLang(e.target.value as Lang)}>
        {Object.entries(LANGS).map(([code, l]) => <option key={code} value={code}>{l.label}</option>)}
      </select>
    </span>
  );
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const { t } = useI18n();

  return (
    <>
      <header className="site-header">
        <nav className="nav" aria-label="Main">
          <Link className="logo" to="/"><LogoMark />WorshipCommons</Link>
          <button className="nav-toggle" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}><span></span><span></span><span></span></button>
          <ul className={"nav-menu" + (open ? " open" : "")} onClick={() => setOpen(false)}>
            <li><NavLink to="/songs">{t("Songs")}</NavLink></li>
            <li><NavLink to="/library" data-testid="nav-library">{t("Saved songs")}</NavLink></li>
            <li><NavLink to="/license">{t("The License")}</NavLink></li>
            <li><NavLink to="/report">{t("Report")}</NavLink></li>
            {user && <li><NavLink to="/my-songs" data-testid="my-songs">{t("My submissions")}</NavLink></li>}
            {user
              ? (
                <li className="nav-actions">
                  <details className="nav-account">
                    <summary data-testid="nav-account" onClick={e => e.stopPropagation()}>{user.firstName}</summary>
                    <div className="nav-account-menu">
                      <button type="button" className="nav-signout" data-testid="sign-out" onClick={logout}>{t("Sign out")}</button>
                    </div>
                  </details>
                </li>
              )
              : <li className="nav-actions"><NavLink to="/login" className="nav-signin" data-testid="sign-in">{t("Sign in")}</NavLink></li>}
            <li><LangToggle /></li>
            <li><Link to="/upload" className="btn btn-primary">{t("Share a song")}</Link></li>
          </ul>
        </nav>
      </header>

      <Outlet />

      <footer className="site-footer">
        <div className="wrap">
          <div className="foot-grid">
            <div>
              <Link className="logo" to="/"><LogoMark />WorshipCommons</Link>
              <p className="foot-note">{t("Free worship music for every church.")}<br />{t("Full commercial rights for every writer.")}</p>
            </div>
            <div>
              <h4>{t("Explore")}</h4>
              <ul>
                <li><Link to="/songs">{t("Song library")}</Link></li>
                <li><Link to="/upload">{t("Share a song")}</Link></li>
                <li><Link to="/license">{t("How the license works")}</Link></li>
              </ul>
            </div>
            <div>
              <h4>{t("Trust")}</h4>
              <ul>
                <li><Link to="/report">{t("Report a song")}</Link></li>
                <li><Link to="/license#who">{t("Who qualifies")}</Link></li>
                <li><Link to="/license#faq">{t("Questions")}</Link></li>
                <li><a href="https://churchapps.org/privacy">{t("Privacy")}</a></li>
                <li><Link to="/terms">{t("Terms")}</Link></li>
              </ul>
            </div>
          </div>
          <p className="foot-note">{t("© 2026 WorshipCommons. The songs belong to their writers. The singing belongs to everyone.")}</p>
        </div>
      </footer>
    </>
  );
}
