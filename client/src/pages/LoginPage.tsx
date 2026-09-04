import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { homePathForRole } from "../api";
import { useAuth } from "../auth";

type AccountChoice = "USER" | "ADMIN";

const ACCOUNTS: Record<
  AccountChoice,
  { label: string; description: string; email: string }
> = {
  USER: {
    label: "User",
    description: "Browse showtimes and book seats",
    email: "user@cinema.local",
  },
  ADMIN: {
    label: "Admin",
    description: "Manage movies, showtimes, and reservations",
    email: "admin@cinema.local",
  },
};

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const [choice, setChoice] = useState<AccountChoice>("USER");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to={homePathForRole(user.role)} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(ACCOUNTS[choice].email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <section className="auth-visual" aria-label="Marquee">
        <p className="brand-mark">Marquee</p>
        <p>
          A fictional neighborhood cinema on Harbor Lane — with real movies playing now.
        </p>
      </section>

      <section className="auth-panel">
        <h1>Select user</h1>

        <form className="auth-form" onSubmit={onSubmit}>
          <fieldset className="role-picker">
            <legend>Account</legend>
            <div className="role-picker-grid">
              {(Object.keys(ACCOUNTS) as AccountChoice[]).map((key) => {
                const account = ACCOUNTS[key];
                const selected = choice === key;
                return (
                  <label
                    key={key}
                    className={selected ? "role-card selected" : "role-card"}
                  >
                    <input
                      type="radio"
                      name="account"
                      value={key}
                      checked={selected}
                      onChange={() => {
                        setChoice(key);
                        setError(null);
                      }}
                    />
                    <strong>{account.label}</strong>
                    <span>{account.description}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Enter password"
            />
          </label>

          {error && <p className="form-error">{error}</p>}

          <button className="btn btn-primary" type="submit" disabled={submitting || !password}>
            {submitting ? "Please wait…" : "Continue"}
          </button>
        </form>
      </section>
    </div>
  );
}
