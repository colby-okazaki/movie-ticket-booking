import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth";

const ADMIN_EMAIL = "admin@cinema.local";

/** Staff-only sign-in. Visitors never see this unless they click "Admin". */
export function AdminLoginPage() {
  const { user, loading, login } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user?.role === "ADMIN") {
    return <Navigate to="/admin" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(ADMIN_EMAIL, password);
    } catch {
      setError("Incorrect password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <section className="auth-visual" aria-label="Marquee">
        <p className="brand-mark">Marquee</p>
        <p>Staff access for managing movies, showtimes, and reservations.</p>
      </section>

      <section className="auth-panel">
        <h1>Admin sign-in</h1>

        <form className="auth-form" onSubmit={onSubmit}>
          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              autoComplete="current-password"
              placeholder="Enter admin password"
            />
          </label>

          {error && <p className="form-error">{error}</p>}

          <button className="btn btn-primary" type="submit" disabled={submitting || !password}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
          <Link to="/browse" className="text-btn back-to-site">
            ← Back to showtimes
          </Link>
        </form>
      </section>
    </div>
  );
}
