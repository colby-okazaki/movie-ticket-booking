import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatMoney, formatShowtime, type Reservation } from "../api";
import { useAuth } from "../auth";
import { AppLayout } from "../Layout";

type Tab = "upcoming" | "past" | "cancelled";

function ticketCode(id: string) {
  return id.slice(-8).toUpperCase();
}

function isUpcoming(r: Reservation) {
  return r.status === "CONFIRMED" && new Date(r.showtime.startsAt) > new Date();
}

function isPast(r: Reservation) {
  return r.status === "CONFIRMED" && new Date(r.showtime.startsAt) <= new Date();
}

export function ReservationsPage() {
  const { token, user } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("upcoming");

  async function load() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.myReservations(token);
      setReservations(result.reservations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const grouped = useMemo(() => {
    const upcoming = reservations
      .filter(isUpcoming)
      .sort(
        (a, b) =>
          new Date(a.showtime.startsAt).getTime() - new Date(b.showtime.startsAt).getTime(),
      );
    const past = reservations
      .filter(isPast)
      .sort(
        (a, b) =>
          new Date(b.showtime.startsAt).getTime() - new Date(a.showtime.startsAt).getTime(),
      );
    const cancelled = reservations
      .filter((r) => r.status === "CANCELLED")
      .sort(
        (a, b) =>
          new Date(b.cancelledAt ?? b.createdAt).getTime() -
          new Date(a.cancelledAt ?? a.createdAt).getTime(),
      );
    return { upcoming, past, cancelled };
  }, [reservations]);

  const visible =
    tab === "upcoming" ? grouped.upcoming : tab === "past" ? grouped.past : grouped.cancelled;

  async function cancel(id: string) {
    if (!token) return;
    const ok = window.confirm("Cancel this ticket? Seats will go back on sale.");
    if (!ok) return;
    setBusyId(id);
    setError(null);
    try {
      await api.cancelReservation(token, id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppLayout>
      <div className="page-head">
        <div>
          <h1>My Tickets</h1>
          <p>
            {user?.name ? `${user.name} · ` : ""}
            {grouped.upcoming.length} upcoming
            {grouped.upcoming.length === 1 ? " show" : " shows"}
          </p>
        </div>
        <Link className="btn btn-primary" to="/browse">
          Find a show
        </Link>
      </div>

      <div className="ticket-tabs" role="tablist" aria-label="Ticket filters">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "upcoming"}
          className={tab === "upcoming" ? "ticket-tab active" : "ticket-tab"}
          onClick={() => setTab("upcoming")}
        >
          Upcoming ({grouped.upcoming.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "past"}
          className={tab === "past" ? "ticket-tab active" : "ticket-tab"}
          onClick={() => setTab("past")}
        >
          Past ({grouped.past.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "cancelled"}
          className={tab === "cancelled" ? "ticket-tab active" : "ticket-tab"}
          onClick={() => setTab("cancelled")}
        >
          Cancelled ({grouped.cancelled.length})
        </button>
      </div>

      {loading && <p className="muted">Loading tickets…</p>}
      {error && <p className="form-error">{error}</p>}

      {!loading && visible.length === 0 && (
        <div className="ticket-empty">
          {tab === "upcoming" && (
            <>
              <p>No upcoming tickets.</p>
              <Link to="/browse">Browse showtimes</Link>
            </>
          )}
          {tab === "past" && <p>No past tickets yet.</p>}
          {tab === "cancelled" && <p>No cancelled tickets.</p>}
        </div>
      )}

      <div className="ticket-list">
        {visible.map((r) => {
          const upcoming = isUpcoming(r);
          return (
            <article
              key={r.id}
              className={`ticket-card${r.status === "CANCELLED" ? " cancelled" : ""}`}
            >
              <div className="ticket-stub">
                <img src={r.showtime.movie.posterUrl} alt="" />
              </div>

              <div className="ticket-body">
                <div className="ticket-top">
                  <p className="ticket-cinema">Marquee · Harbor Lane</p>
                  <p className={`ticket-badge status-${r.status.toLowerCase()}`}>
                    {upcoming ? "Admit one" : r.status === "CANCELLED" ? "Cancelled" : "Used"}
                  </p>
                </div>

                <h2>{r.showtime.movie.title}</h2>
                <p className="ticket-when">{formatShowtime(r.showtime.startsAt)}</p>

                <dl className="ticket-meta">
                  <div>
                    <dt>Seats</dt>
                    <dd>
                      <span className="seat-pills">
                        {r.seats.map((s) => (
                          <span key={s.label} className="seat-pill">
                            {s.label}
                          </span>
                        ))}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt>Paid</dt>
                    <dd>{formatMoney(r.totalCents)}</dd>
                  </div>
                  <div>
                    <dt>Code</dt>
                    <dd className="ticket-code">{ticketCode(r.id)}</dd>
                  </div>
                </dl>

                {upcoming && (
                  <div className="ticket-actions">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={busyId === r.id}
                      onClick={() => void cancel(r.id)}
                    >
                      {busyId === r.id ? "Cancelling…" : "Cancel ticket"}
                    </button>
                  </div>
                )}
              </div>

              <div className="ticket-tear" aria-hidden="true">
                <span>{ticketCode(r.id)}</span>
              </div>
            </article>
          );
        })}
      </div>
    </AppLayout>
  );
}
