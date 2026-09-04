import { useCallback, useEffect, useState } from "react";
import {
  api,
  formatMoney,
  formatShowtime,
  type AdminReservation,
} from "../api";
import { useAuth } from "../auth";
import { AdminLayout } from "./AdminLayout";

type StatusFilter = "ALL" | "CONFIRMED" | "CANCELLED";

export function AdminReservationsPage() {
  const { token } = useAuth();
  const [reservations, setReservations] = useState<AdminReservation[]>([]);
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.allReservations(
        token,
        status === "ALL" ? undefined : { status },
      );
      setReservations(result.reservations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reservations");
    } finally {
      setLoading(false);
    }
  }, [token, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCancel(id: string) {
    if (!token) return;
    if (!window.confirm("Cancel this reservation and release the seats?")) return;
    setCancellingId(id);
    setError(null);
    try {
      await api.cancelReservation(token, id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setCancellingId(null);
    }
  }

  const upcoming = (iso: string) => new Date(iso) > new Date();

  return (
    <AdminLayout>
      <header className="admin-head">
        <div>
          <h1>Reservations</h1>
          <p className="muted">All customer bookings across showtimes.</p>
        </div>
        <div className="admin-filter-tabs">
          {(["ALL", "CONFIRMED", "CANCELLED"] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={status === value ? "admin-filter-tab active" : "admin-filter-tab"}
              onClick={() => setStatus(value)}
            >
              {value === "ALL" ? "All" : value.charAt(0) + value.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </header>

      {error && <p className="form-error">{error}</p>}
      {loading && <p className="muted">Loading…</p>}

      {!loading && reservations.length === 0 && (
        <p className="muted">No reservations match this filter.</p>
      )}

      {!loading && reservations.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Guest</th>
                <th>Movie</th>
                <th>Showtime</th>
                <th>Seats</th>
                <th>Total</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {reservations.map((res) => (
                <tr key={res.id}>
                  <td>
                    <strong>{res.user.name}</strong>
                    <br />
                    <span className="muted admin-table-sub">{res.user.email}</span>
                  </td>
                  <td>{res.showtime.movie.title}</td>
                  <td>{formatShowtime(res.showtime.startsAt)}</td>
                  <td>
                    <span className="seat-pills">
                      {res.seats.map((s) => (
                        <span key={s.label} className="seat-pill">
                          {s.label}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td>{formatMoney(res.totalCents)}</td>
                  <td>
                    <span className={`status status-${res.status.toLowerCase()}`}>
                      {res.status}
                    </span>
                  </td>
                  <td>
                    {res.status === "CONFIRMED" && upcoming(res.showtime.startsAt) && (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={cancellingId === res.id}
                        onClick={() => void onCancel(res.id)}
                      >
                        {cancellingId === res.id ? "…" : "Cancel"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}
