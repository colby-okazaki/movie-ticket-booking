import { useEffect, useState } from "react";
import {
  api,
  formatMoney,
  formatPercent,
  formatShowtime,
  todayTheaterDate,
  type ReportSummary,
} from "../api";
import { useAuth } from "../auth";
import { AdminLayout } from "./AdminLayout";

export function AdminDashboardPage() {
  const { token } = useAuth();
  const [date, setDate] = useState(todayTheaterDate);
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await api.reportSummary(token, date);
        if (!cancelled) setReport(result);
      } catch (err) {
        if (!cancelled) {
          setReport(null);
          setError(err instanceof Error ? err.message : "Failed to load report");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token, date]);

  return (
    <AdminLayout>
      <header className="admin-head">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">Occupancy and revenue across showtimes.</p>
        </div>
        <label className="date-field admin-date-field">
          <span>Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </header>

      {error && <p className="form-error">{error}</p>}
      {loading && <p className="muted">Loading report…</p>}

      {report && !loading && (
        <>
          <section className="admin-stat-grid">
            <article className="admin-stat">
              <p className="admin-stat-label">Revenue</p>
              <p className="admin-stat-value">{formatMoney(report.totals.revenueCents)}</p>
            </article>
            <article className="admin-stat">
              <p className="admin-stat-label">Reservations</p>
              <p className="admin-stat-value">{report.totals.confirmedReservations}</p>
            </article>
            <article className="admin-stat">
              <p className="admin-stat-label">Seats sold</p>
              <p className="admin-stat-value">
                {report.totals.reservedSeats} / {report.totals.capacity}
              </p>
            </article>
            <article className="admin-stat">
              <p className="admin-stat-label">Occupancy</p>
              <p className="admin-stat-value">{formatPercent(report.totals.occupancyRate)}</p>
            </article>
          </section>

          <section className="admin-panel">
            <h2 className="admin-panel-title">Showtimes</h2>
            {report.showtimes.length === 0 ? (
              <p className="muted">No showtimes scheduled for this date.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Movie</th>
                      <th>Sold</th>
                      <th>Open</th>
                      <th>Fill</th>
                      <th>Orders</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.showtimes.map((row) => (
                      <tr key={row.showtimeId}>
                        <td>{formatShowtime(row.startsAt)}</td>
                        <td>{row.movie.title}</td>
                        <td>{row.reservedSeats}</td>
                        <td>{row.availableSeats}</td>
                        <td>{formatPercent(row.occupancyRate)}</td>
                        <td>{row.confirmedReservations}</td>
                        <td>{formatMoney(row.revenueCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </AdminLayout>
  );
}
