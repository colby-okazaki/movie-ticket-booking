import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import {
  api,
  formatMoney,
  formatShowtime,
  todayUtcDate,
  type ShowtimeSummary,
} from "../api";
import { AppLayout } from "../Layout";

export function BrowsePage() {
  const [date, setDate] = useState(todayUtcDate);
  const [showtimes, setShowtimes] = useState<ShowtimeSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await api.showtimesByDate(date);
        if (cancelled) return;
        if (result.showtimes.length === 0) {
          const today = todayUtcDate();
          if (date === today) {
            for (let offset = 1; offset <= 14; offset++) {
              const nextDate = addDays(today, offset);
              const next = await api.showtimesByDate(nextDate);
              if (cancelled) return;
              if (next.showtimes.length > 0) {
                setDate(nextDate);
                setShowtimes(next.showtimes);
                return;
              }
            }
          }
        }
        setShowtimes(result.showtimes);
      } catch (err) {
        if (!cancelled) {
          setShowtimes([]);
          setError(err instanceof Error ? err.message : "Failed to load showtimes");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [date]);

  const grouped = useMemo(() => {
    const map = new Map<string, { movie: ShowtimeSummary["movie"]; showtimes: ShowtimeSummary[] }>();
    for (const st of showtimes) {
      const existing = map.get(st.movie.id);
      if (existing) existing.showtimes.push(st);
      else map.set(st.movie.id, { movie: st.movie, showtimes: [st] });
    }
    return [...map.values()];
  }, [showtimes]);

  function shiftDate(days: number) {
    setDate((current) => addDays(current, days));
  }

  function onDateKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      shiftDate(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      shiftDate(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      shiftDate(7);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      shiftDate(-7);
    }
  }

  return (
    <AppLayout>
      <div className="page-head">
        <div>
          <h1>Showtimes</h1>
          <p>
            Now playing at Marquee (Harbor Lane) — schedule mirrored from public theater listings.
            Arrow keys move by day (↑/↓ by week).
          </p>
        </div>
        <div className="date-controls">
          <button
            type="button"
            className="btn btn-ghost date-step"
            aria-label="Previous day"
            onClick={() => shiftDate(-1)}
          >
            ←
          </button>
          <label className="date-field">
            <span>Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              onKeyDown={onDateKeyDown}
            />
          </label>
          <button
            type="button"
            className="btn btn-ghost date-step"
            aria-label="Next day"
            onClick={() => shiftDate(1)}
          >
            →
          </button>
        </div>
      </div>

      {loading && <p className="muted">Loading…</p>}
      {error && <p className="form-error">{error}</p>}
      {!loading && !error && grouped.length === 0 && (
        <p className="muted">
          Nothing playing on this date. Try {tomorrowUtcDate()} or {todayUtcDate()}.
        </p>
      )}

      <div className="movie-list">
        {grouped.map(({ movie, showtimes: sts }) => (
          <article key={movie.id} className="movie-row">
            <img className="poster" src={movie.posterUrl} alt="" />
            <div className="movie-copy">
              <h2>{movie.title}</h2>
              <p className="genres">{movie.genres.map((g) => g.name).join(" / ")}</p>
              <p className="desc">{movie.description}</p>
              <div className="showtime-row">
                {sts.map((st) => (
                  <Link key={st.id} className="showtime-btn" to={`/showtimes/${st.id}`}>
                    <strong>{formatShowtime(st.startsAt)}</strong>
                    <span>
                      {formatMoney(st.priceCents)} · {st.availableSeats} left
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </AppLayout>
  );
}

function tomorrowUtcDate() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
