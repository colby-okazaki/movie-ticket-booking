import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  api,
  formatMoney,
  formatShowtime,
  type Seat,
  type ShowtimeDetail,
} from "../api";
import { useAuth } from "../auth";
import { AppLayout } from "../Layout";

export function ShowtimePage() {
  const { id = "" } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [showtime, setShowtime] = useState<ShowtimeDetail | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await api.showtime(id);
        if (!cancelled) {
          setShowtime(result.showtime);
          setSelected(new Set());
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const seatsByRow = useMemo(() => {
    const map = new Map<string, Seat[]>();
    for (const seat of showtime?.seats ?? []) {
      const row = map.get(seat.row) ?? [];
      row.push(seat);
      map.set(seat.row, row);
    }
    return [...map.entries()];
  }, [showtime]);

  function toggleSeat(seat: Seat) {
    if (!seat.available) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(seat.label)) next.delete(seat.label);
      else {
        if (next.size >= 10) return prev;
        next.add(seat.label);
      }
      return next;
    });
  }

  async function reserve() {
    if (!token || !showtime || selected.size === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const seats = [...selected].map((label) => {
        const seat = showtime.seats.find((s) => s.label === label)!;
        return { row: seat.row, number: seat.number };
      });
      await api.reserve(token, { showtimeId: showtime.id, seats });
      navigate("/tickets");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reservation failed");
      const refreshed = await api.showtime(id);
      setShowtime(refreshed.showtime);
      setSelected(new Set());
    } finally {
      setSubmitting(false);
    }
  }

  const totalCents = (showtime?.priceCents ?? 0) * selected.size;

  return (
    <AppLayout>
      {loading && <p className="muted">Loading seat map…</p>}
      {error && <p className="form-error">{error}</p>}

      {showtime && (
        <>
          <div className="page-head seat-head">
            <div>
              <p className="eyebrow">
                <Link to="/browse">← All showtimes</Link>
              </p>
              <h1>{showtime.movie.title}</h1>
              <p>
                {formatShowtime(showtime.startsAt)} · {formatMoney(showtime.priceCents)} ·{" "}
                {showtime.availableSeats} open
              </p>
            </div>
            <img className="poster poster-sm" src={showtime.movie.posterUrl} alt="" />
          </div>

          <div className="screen-label">Screen</div>
          <div className="seat-map">
            {seatsByRow.map(([row, seats]) => (
              <div key={row} className="seat-row">
                <span className="row-label">{row}</span>
                <div className="seat-buttons">
                  {seats.map((seat) => {
                    const isSelected = selected.has(seat.label);
                    const className = [
                      "seat",
                      !seat.available ? "taken" : "",
                      isSelected ? "selected" : "",
                    ]
                      .filter(Boolean)
                      .join(" ");
                    return (
                      <button
                        key={seat.id}
                        type="button"
                        className={className}
                        disabled={!seat.available}
                        onClick={() => toggleSeat(seat)}
                        title={seat.label}
                        aria-pressed={isSelected}
                      >
                        {seat.number}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="legend">
            <span>
              <i className="swatch open" /> Open
            </span>
            <span>
              <i className="swatch selected" /> Yours
            </span>
            <span>
              <i className="swatch taken" /> Taken
            </span>
          </div>

          <div className="checkout-bar">
            <div>
              <strong>
                {selected.size === 0 ? "Select seats" : [...selected].sort().join(", ")}
              </strong>
              <p className="muted">
                {selected.size > 0 ? formatMoney(totalCents) : "Max 10 seats"}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={selected.size === 0 || submitting}
              onClick={() => void reserve()}
            >
              {submitting ? "Booking…" : "Book"}
            </button>
          </div>
        </>
      )}
    </AppLayout>
  );
}
