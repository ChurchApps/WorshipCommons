import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth";

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

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();

  return (
    <>
      <header className="site-header">
        <nav className="nav" aria-label="Main">
          <Link className="logo" to="/"><LogoMark />WorshipCommons</Link>
          <button className="nav-toggle" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}><span></span><span></span><span></span></button>
          <ul className={"nav-menu" + (open ? " open" : "")} onClick={() => setOpen(false)}>
            <li><NavLink to="/songs">Songs</NavLink></li>
            <li><NavLink to="/license">The License</NavLink></li>
            <li><NavLink to="/report">Report</NavLink></li>
            {user && <li><NavLink to="/my-songs" data-testid="my-songs">My songs</NavLink></li>}
            {user
              ? <li><button className="nav-signout" data-testid="sign-out" onClick={logout}>Sign out ({user.firstName})</button></li>
              : <li><NavLink to="/login" data-testid="sign-in">Sign in</NavLink></li>}
            <li><Link to="/upload" className="btn btn-primary">Share a song</Link></li>
          </ul>
        </nav>
      </header>

      <Outlet />

      <footer className="site-footer">
        <div className="wrap">
          <div className="foot-grid">
            <div>
              <Link className="logo" to="/"><LogoMark />WorshipCommons</Link>
              <p className="foot-note">Free worship music for every church.<br />Full commercial rights for every writer.</p>
            </div>
            <div>
              <h4>Explore</h4>
              <ul>
                <li><Link to="/songs">Song library</Link></li>
                <li><Link to="/upload">Share a song</Link></li>
                <li><Link to="/license">How the license works</Link></li>
              </ul>
            </div>
            <div>
              <h4>Trust</h4>
              <ul>
                <li><Link to="/report">Report a song</Link></li>
                <li><Link to="/license#who">Who qualifies</Link></li>
                <li><Link to="/license#faq">Questions</Link></li>
                <li><a href="https://churchapps.org/privacy">Privacy</a></li>
                <li><a href="https://churchapps.org/terms">Terms</a></li>
              </ul>
            </div>
          </div>
          <p className="foot-note">© 2026 WorshipCommons. The songs belong to their writers. The singing belongs to everyone.</p>
        </div>
      </footer>
    </>
  );
}
