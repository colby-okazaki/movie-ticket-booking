import { Link } from "react-router-dom";
import type { ReactNode } from "react";

export function AppLayout({ children }: { children: ReactNode }) {

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/browse" className="brand-mark brand-link">
          MARQUEE
        </Link>
        <nav className="topnav">
          <Link to="/browse">Showtimes</Link>
          <Link to="/tickets">My Tickets</Link>
          <Link to="/admin/login" className="admin-corner-link" title="Staff sign-in">
            Admin
          </Link>
        </nav>
      </header>
      <main className="page">{children}</main>
      <footer className="site-footer">
        Showtimes are in Pacific Time. Movie data and posters from{" "}
        <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer">
          TMDB
        </a>
        . This product uses the TMDB API but is not endorsed or certified by TMDB.
      </footer>
    </div>
  );
}
