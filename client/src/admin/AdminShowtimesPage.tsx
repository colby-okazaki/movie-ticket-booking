import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  api,
  formatMoney,
  formatShowtime,
  localDatetimeToIso,
  toLocalDatetimeInput,
  todayTheaterDate,
  type MovieCatalogEntry,
  type ShowtimeSummary,
} from "../api";
import { useAuth } from "../auth";
import { AdminLayout } from "./AdminLayout";

type ShowtimeForm = {
  movieId: string;
  startsAt: string;
  priceCents: number;
  rows: number;
  seatsPerRow: number;
};

const defaultForm = (): ShowtimeForm => ({
  movieId: "",
  startsAt: toLocalDatetimeInput(new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()),
  priceCents: 1499,
  rows: 8,
  seatsPerRow: 12,
});

export function AdminShowtimesPage() {
  const { token } = useAuth();
  const [date, setDate] = useState(todayTheaterDate);
  const [movies, setMovies] = useState<MovieCatalogEntry[]>([]);
  const [showtimes, setShowtimes] = useState<ShowtimeSummary[]>([]);
  const [form, setForm] = useState<ShowtimeForm>(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState(1499);
  const [editStartsAt, setEditStartsAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [moviesRes, showtimesRes] = await Promise.all([
        api.movies(),
        api.showtimesByDate(date),
      ]);
      setMovies(moviesRes.movies);
      setShowtimes(showtimesRes.showtimes);
      setForm((prev) => ({
        ...prev,
        movieId: prev.movieId || moviesRes.movies[0]?.id || "",
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load showtimes");
    } finally {
      setLoading(false);
    }
  }, [token, date]);

  useEffect(() => {
    void load();
  }, [load]);

  function startEdit(st: ShowtimeSummary) {
    setEditingId(st.id);
    setEditStartsAt(toLocalDatetimeInput(st.startsAt));
    setEditPrice(st.priceCents);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setError(null);
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.createShowtime(token, {
        movieId: form.movieId,
        startsAt: localDatetimeToIso(form.startsAt),
        priceCents: form.priceCents,
        rows: form.rows,
        seatsPerRow: form.seatsPerRow,
      });
      setForm(defaultForm());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function onUpdate(id: string) {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.updateShowtime(token, id, {
        startsAt: localDatetimeToIso(editStartsAt),
        priceCents: editPrice,
      });
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(id: string) {
    if (!token) return;
    if (!window.confirm("Delete this showtime? Only works if no reservations exist.")) return;
    setError(null);
    try {
      await api.deleteShowtime(token, id);
      if (editingId === id) setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <AdminLayout>
      <header className="admin-head">
        <div>
          <h1>Showtimes</h1>
          <p className="muted">Schedule screenings and set seat maps.</p>
        </div>
        <label className="date-field admin-date-field">
          <span>Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </header>

      <div className="admin-split">
        <section className="admin-panel">
          <h2 className="admin-panel-title">New showtime</h2>
          <form className="admin-form" onSubmit={onCreate}>
            <label>
              <span>Movie</span>
              <select
                value={form.movieId}
                onChange={(e) => setForm((f) => ({ ...f, movieId: e.target.value }))}
                required
              >
                <option value="" disabled>
                  Select movie
                </option>
                {movies.map((movie) => (
                  <option key={movie.id} value={movie.id}>
                    {movie.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Starts at</span>
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                required
              />
            </label>
            <label>
              <span>Ticket price (cents)</span>
              <input
                type="number"
                min={1}
                value={form.priceCents}
                onChange={(e) => setForm((f) => ({ ...f, priceCents: Number(e.target.value) }))}
                required
              />
            </label>
            <div className="admin-form-row">
              <label>
                <span>Rows</span>
                <input
                  type="number"
                  min={1}
                  max={26}
                  value={form.rows}
                  onChange={(e) => setForm((f) => ({ ...f, rows: Number(e.target.value) }))}
                  required
                />
              </label>
              <label>
                <span>Seats per row</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={form.seatsPerRow}
                  onChange={(e) => setForm((f) => ({ ...f, seatsPerRow: Number(e.target.value) }))}
                  required
                />
              </label>
            </div>
            <p className="muted admin-hint">
              Creates a {form.rows}×{form.seatsPerRow} seat grid ({form.rows * form.seatsPerRow}{" "}
              seats).
            </p>
            {error && !editingId && <p className="form-error">{error}</p>}
            <button className="btn btn-primary" type="submit" disabled={submitting || !form.movieId}>
              {submitting ? "Creating…" : "Create showtime"}
            </button>
          </form>
        </section>

        <section className="admin-panel">
          <h2 className="admin-panel-title">
            Schedule for {date} ({showtimes.length})
          </h2>
          {loading && <p className="muted">Loading…</p>}
          {!loading && showtimes.length === 0 && (
            <p className="muted">No showtimes on this date.</p>
          )}
          <div className="admin-showtime-list">
            {showtimes.map((st) => (
              <article key={st.id} className="admin-showtime-row">
                {editingId === st.id ? (
                  <div className="admin-inline-edit">
                    <p className="admin-inline-title">{st.movie.title}</p>
                    <label>
                      <span>Starts at</span>
                      <input
                        type="datetime-local"
                        value={editStartsAt}
                        onChange={(e) => setEditStartsAt(e.target.value)}
                      />
                    </label>
                    <label>
                      <span>Price (cents)</span>
                      <input
                        type="number"
                        min={1}
                        value={editPrice}
                        onChange={(e) => setEditPrice(Number(e.target.value))}
                      />
                    </label>
                    {error && <p className="form-error">{error}</p>}
                    <div className="admin-form-actions">
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={submitting}
                        onClick={() => void onUpdate(st.id)}
                      >
                        Save
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={cancelEdit}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <h3>{st.movie.title}</h3>
                      <p>{formatShowtime(st.startsAt)}</p>
                      <p className="muted admin-meta">
                        {formatMoney(st.priceCents)} · {st.capacity} seats · {st.availableSeats}{" "}
                        open · {st.rows}×{st.seatsPerRow}
                      </p>
                    </div>
                    <div className="admin-row-actions">
                      <button type="button" className="btn btn-ghost" onClick={() => startEdit(st)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => void onDelete(st.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
