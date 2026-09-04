import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../auth";

const links = [
  { to: "/admin", end: true, label: "Dashboard" },
  { to: "/admin/movies", end: false, label: "Movies" },
  { to: "/admin/showtimes", end: false, label: "Showtimes" },
  { to: "/admin/reservations", end: false, label: "Reservations" },
] as const;

export function AdminLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <p className="brand-mark">Marquee</p>
          <p className="admin-badge">Operations</p>
        </div>
        <nav className="admin-nav">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => (isActive ? "admin-nav-link active" : "admin-nav-link")}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="admin-sidebar-foot">
          <p className="admin-user">{user?.name}</p>
          <p className="admin-user-email">{user?.email}</p>
          <button type="button" className="btn btn-ghost admin-signout" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>
      <div className="admin-main">
        <main className="admin-page">{children}</main>
      </div>
    </div>
  );
}
