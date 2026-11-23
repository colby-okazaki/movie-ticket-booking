import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./auth";
import { AdminDashboardPage } from "./admin/AdminDashboardPage";
import { AdminMoviesPage } from "./admin/AdminMoviesPage";
import { AdminReservationsPage } from "./admin/AdminReservationsPage";
import { AdminShowtimesPage } from "./admin/AdminShowtimesPage";
import { BrowsePage } from "./pages/BrowsePage";
import { AdminLoginPage } from "./pages/AdminLoginPage";
import { ReservationsPage } from "./pages/ReservationsPage";
import { ShowtimePage } from "./pages/ShowtimePage";

function LoadingShell() {
  return (
    <div className="auth-shell">
      <p className="muted">Loading…</p>
    </div>
  );
}

function UserRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingShell />;
  if (!user) {
    return (
      <div className="auth-shell">
        <p className="muted">
          Couldn’t start your session. <a href="/browse">Try again</a>
        </p>
      </div>
    );
  }
  if (user.role === "ADMIN") return <Navigate to="/admin" replace />;
  return children;
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingShell />;
  if (user?.role !== "ADMIN") return <Navigate to="/admin/login" replace />;
  return children;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingShell />;
  return <Navigate to={user?.role === "ADMIN" ? "/admin" : "/browse"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/home" element={<HomeRedirect />} />
      <Route
        path="/browse"
        element={
          <UserRoute>
            <BrowsePage />
          </UserRoute>
        }
      />
      <Route
        path="/showtimes/:id"
        element={
          <UserRoute>
            <ShowtimePage />
          </UserRoute>
        }
      />
      <Route
        path="/tickets"
        element={
          <UserRoute>
            <ReservationsPage />
          </UserRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminDashboardPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/movies"
        element={
          <AdminRoute>
            <AdminMoviesPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/showtimes"
        element={
          <AdminRoute>
            <AdminShowtimesPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/reservations"
        element={
          <AdminRoute>
            <AdminReservationsPage />
          </AdminRoute>
        }
      />
      <Route path="/reservations" element={<Navigate to="/tickets" replace />} />
      <Route path="*" element={<Navigate to="/browse" replace />} />
    </Routes>
  );
}
