import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth";

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();

  return (
    <>
      <header className="site-header">
        <nav className="nav" aria-label="Main">
          <Link className="logo" to="/"><span className="logo-mark">WC</span>WorshipCommons</Link>
          <button className="nav-toggle" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}><span></span><span></span><span></span></button>
          <ul className={"nav-menu" + (open ? " open" : "")} onClick={() => setOpen(false)}>
            <li><NavLink to="/songs">Songs</NavLink></li>
            <li><NavLink to="/license">The License</NavLink></li>
            <li><NavLink to="/report">Report</NavLink></li>
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
              <Link className="logo" to="/"><span className="logo-mark">WC</span>WorshipCommons</Link>
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
              </ul>
            </div>
          </div>
          <p className="foot-note">© 2026 WorshipCommons. The songs belong to their writers. The singing belongs to everyone.</p>
        </div>
      </footer>
    </>
  );
}
