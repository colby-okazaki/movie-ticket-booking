import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./auth";

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/browse" className="brand-mark brand-link">
          MARQUEE
        </Link>
        <nav className="topnav">
          <Link to="/browse">Showtimes</Link>
          <Link to="/tickets">My Tickets</Link>
          <button type="button" className="text-btn" onClick={logout}>
            Sign out{user?.name ? ` · ${user.name}` : ""}
          </button>
        </nav>
      </header>
      <main className="page">{children}</main>
    </div>
  );
}
