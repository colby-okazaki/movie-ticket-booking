import { randomUUID } from "node:crypto";
import { Prisma, Role, type PrismaClient } from "@prisma/client";
import { addDays, daysBetween, theaterClock, theaterTimeToDate, theaterToday } from "./time.js";

/**
 * Keeps Marquee's lineup in step with real theaters: titles come from TMDB's
 * US "now playing" / "upcoming" lists, showtimes and pre-sold seats are made up.
 * Safe to run repeatedly — it only adds what's missing and never touches real
 * customers' reservations.
 */

export type Weight = "wide" | "solid" | "limited";

export type CatalogMovie = {
  tmdbId?: number;
  title: string;
  description: string;
  posterUrl: string;
  genres: string[];
  /** Theater-local HH:mm slots this title plays each day */
  slots: string[];
  weight: Weight;
  /** Theater-local release date, YYYY-MM-DD */
  releaseDate: string;
};

const DAYS_OUT: Record<Weight, number> = { wide: 14, solid: 10, limited: 7 };
const PRICE_CENTS: Record<Weight, number> = { wide: 1699, solid: 1549, limited: 1399 };
const ROOM: Record<Weight, { rows: number; seatsPerRow: number }> = {
  wide: { rows: 10, seatsPerRow: 14 },
  solid: { rows: 8, seatsPerRow: 12 },
  limited: { rows: 8, seatsPerRow: 12 },
};
/** Showtimes this soon get extra walk-in sales each run, so they fill up as they approach. */
const TOP_UP_DAYS = 3;
/** Past showtimes (and their tickets) are kept this long for "My Tickets" history. */
const KEEP_PAST_DAYS = 7;
const MAX_TITLES = 18;
const BOX_OFFICE_EMAIL = "boxoffice@cinema.local";

// ---------------------------------------------------------------------------
// TMDB
// ---------------------------------------------------------------------------

type TmdbMovie = {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  genre_ids: number[];
  release_date: string;
  popularity: number;
  original_language: string;
};

async function tmdb<T>(path: string, apiKey: string, params: Record<string, string> = {}) {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  url.search = new URLSearchParams({ api_key: apiKey, language: "en-US", ...params }).toString();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB ${path} → HTTP ${res.status}`);
  return (await res.json()) as T;
}

const GENRE_RENAMES: Record<string, string> = { "Science Fiction": "Sci-Fi" };
const SKIP_GENRES = new Set(["TV Movie"]);

type TmdbDetails = {
  budget: number;
  release_dates: {
    results: { iso_3166_1: string; release_dates: { type: number; release_date: string }[] }[];
  };
};

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
      }
    }),
  );
  return out;
}

/**
 * Current US lineup from TMDB. A title qualifies by its real US theatrical
 * release (wide or limited) in the last ~10 weeks or next 10 days. How many
 * shows it gets is scored from budget (a stand-in for screen count — and the
 * only signal before opening day) plus current popularity; titles in limited
 * release or already out on digital get the fewest.
 */
export async function fetchTmdbCatalog(apiKey: string, now = new Date()): Promise<CatalogMovie[]> {
  const today = theaterToday(now);
  const [genreList, ...pages] = await Promise.all([
    tmdb<{ genres: { id: number; name: string }[] }>("/genre/movie/list", apiKey),
    ...[1, 2, 3].map((page) =>
      tmdb<{ results: TmdbMovie[] }>("/movie/now_playing", apiKey, { region: "US", page: String(page) }),
    ),
    ...[1, 2].map((page) =>
      tmdb<{ results: TmdbMovie[] }>("/movie/upcoming", apiKey, { region: "US", page: String(page) }),
    ),
  ]);
  const genreName = new Map(genreList.genres.map((g) => [g.id, GENRE_RENAMES[g.name] ?? g.name]));

  const seen = new Set<number>();
  const candidates = pages
    .flatMap((p) => p.results)
    .filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      // Skip anniversary re-releases of old films
      const isNew = !!m.release_date && daysBetween(m.release_date, today) <= 540;
      return isNew && !!m.poster_path && !!m.overview;
    })
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 45);

  // US release types: 2 = limited, 3 = wide theatrical, 4 = digital
  const details = await mapLimit(candidates, 8, (m) =>
    tmdb<TmdbDetails>(`/movie/${m.id}`, apiKey, { append_to_response: "release_dates" }),
  );
  const inWindow = (date: string) => {
    const age = daysBetween(date, today);
    return age <= 70 && age >= -10;
  };

  let popRank = 0;
  const scored = candidates.flatMap((m, i) => {
    const d = details[i]!;
    const rel = (d.release_dates.results.find((r) => r.iso_3166_1 === "US")?.release_dates ?? []).map(
      (r) => ({ type: r.type, date: r.release_date.slice(0, 10) }),
    );
    const wide = rel.find((r) => r.type === 3 && inWindow(r.date));
    const limited = rel.find((r) => r.type === 2 && inWindow(r.date));
    if (!wide && !limited) return [];
    // Showtimes start at the earliest theatrical date (limited opening before going wide)
    const releaseDate = [wide?.date, limited?.date].filter((x): x is string => !!x).sort()[0]!;
    const rank = popRank++;
    const onDigital = rel.some((r) => r.type === 4 && r.date <= today);
    const budgetPts = d.budget >= 100e6 ? 3 : d.budget >= 50e6 ? 2 : d.budget >= 20e6 ? 1 : 0;
    const popPts = rank < 5 ? 2 : rank < 12 ? 1 : 0;
    const score = wide && !onDigital ? budgetPts + popPts : 0;
    return [{ m, releaseDate, score, rank }];
  });

  const ordered = scored.sort((a, b) => b.score - a.score || a.rank - b.rank).slice(0, MAX_TITLES);

  return ordered.map(({ m, releaseDate, score }) => {
    const weight: Weight = score >= 3 ? "wide" : score >= 2 ? "solid" : "limited";
    const genres = m.genre_ids
      .map((id) => genreName.get(id))
      .filter((g): g is string => !!g && !SKIP_GENRES.has(g))
      .slice(0, 3);
    return {
      tmdbId: m.id,
      title: m.title,
      description: m.overview,
      posterUrl: `https://image.tmdb.org/t/p/w500${m.poster_path}`,
      genres: genres.length ? genres : ["Drama"],
      slots: pickSlots(m.id, genres, weight),
      weight,
      releaseDate,
    };
  });
}

const SLOT_TEMPLATES = {
  family: [
    ["10:15", "12:45", "15:15", "17:45"],
    ["10:45", "13:15", "15:50", "18:25"],
    ["11:00", "13:40", "16:20", "19:00"],
  ],
  late: [
    ["14:00", "16:45", "19:30", "22:15"],
    ["14:40", "17:20", "20:00", "22:40"],
    ["13:10", "15:30", "18:45", "21:30"],
  ],
  general: [
    ["12:00", "15:00", "18:15", "21:00"],
    ["11:30", "14:45", "18:00", "21:15"],
    ["13:00", "16:10", "19:20", "22:20"],
    ["12:30", "15:45", "19:00", "22:10"],
  ],
};

/** Stable per title (so a movie keeps its times day to day), shaped by genre and release size. */
export function pickSlots(seed: number, genres: string[], weight: Weight) {
  const kind = genres.some((g) => g === "Family" || g === "Animation")
    ? "family"
    : genres.some((g) => g === "Horror" || g === "Thriller")
      ? "late"
      : "general";
  const options = SLOT_TEMPLATES[kind];
  const slots = options[seed % options.length]!;
  // Smaller releases lose the matinee(s) first — except family titles, which lose the late show.
  const count = weight === "wide" ? 4 : weight === "solid" ? 3 : 2;
  return kind === "family" ? slots.slice(0, count) : slots.slice(slots.length - count);
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

export type SyncStats = {
  titles: number;
  moviesAdded: number;
  showtimesAdded: number;
  seatsPreSold: number;
  seatsToppedUp: number;
  showtimesRemoved: number;
  moviesRetired: number;
};

export async function syncCatalog(
  prisma: PrismaClient,
  catalog: CatalogMovie[],
  now = new Date(),
): Promise<SyncStats> {
  const today = theaterToday(now);
  const stats: SyncStats = {
    titles: catalog.length,
    moviesAdded: 0,
    showtimesAdded: 0,
    seatsPreSold: 0,
    seatsToppedUp: 0,
    showtimesRemoved: 0,
    moviesRetired: 0,
  };

  const boxOffice = await prisma.user.upsert({
    where: { email: BOX_OFFICE_EMAIL },
    update: {},
    create: {
      email: BOX_OFFICE_EMAIL,
      name: "Box Office Walk-ins",
      // Not a bcrypt hash, so no password can ever match — this account can't log in.
      passwordHash: `!disabled-${randomUUID()}`,
      role: Role.USER,
    },
  });

  // --- Movies -------------------------------------------------------------
  const genreIds = new Map<string, string>();
  for (const name of new Set(catalog.flatMap((m) => m.genres))) {
    const g = await prisma.genre.upsert({ where: { name }, update: {}, create: { name } });
    genreIds.set(name, g.id);
  }

  const existing = await prisma.movie.findMany({ select: { id: true, tmdbId: true, title: true } });
  const activeIds = new Set<string>();
  const movieIdFor = new Map<CatalogMovie, string>();

  for (const entry of catalog) {
    const match =
      existing.find((m) => entry.tmdbId != null && m.tmdbId === entry.tmdbId) ??
      existing.find((m) => m.title.toLowerCase() === entry.title.toLowerCase());
    let id: string;
    if (match) {
      await prisma.movie.update({
        where: { id: match.id },
        data: {
          tmdbId: entry.tmdbId ?? match.tmdbId,
          title: entry.title,
          description: entry.description,
          posterUrl: entry.posterUrl,
        },
      });
      id = match.id;
    } else {
      const created = await prisma.movie.create({
        data: {
          tmdbId: entry.tmdbId,
          title: entry.title,
          description: entry.description,
          posterUrl: entry.posterUrl,
          genres: { create: entry.genres.map((name) => ({ genreId: genreIds.get(name)! })) },
        },
      });
      id = created.id;
      stats.moviesAdded++;
    }
    activeIds.add(id);
    movieIdFor.set(entry, id);
  }

  // --- New showtimes (rolling window) -------------------------------------
  const future = await prisma.showtime.findMany({
    where: { startsAt: { gt: now } },
    select: { movieId: true, startsAt: true },
  });
  const booked = new Set(future.map((s) => `${s.movieId}|${s.startsAt.toISOString()}`));

  const showtimeRows: Prisma.ShowtimeCreateManyInput[] = [];
  const reservationRows: Prisma.ReservationCreateManyInput[] = [];
  const seatRows: Prisma.SeatCreateManyInput[] = [];

  for (const entry of catalog) {
    const movieId = movieIdFor.get(entry)!;
    const opensIn = Math.max(0, daysBetween(today, entry.releaseDate));
    // Window counts from release day for new titles, from today for ones already out
    const lastDay = opensIn + DAYS_OUT[entry.weight] - 1;
    for (let day = opensIn; day <= lastDay; day++) {
      const date = addDays(today, day);
      for (const slot of entry.slots) {
        const startsAt = theaterTimeToDate(date, slot);
        if (startsAt <= now || booked.has(`${movieId}|${startsAt.toISOString()}`)) continue;

        const { rows, seatsPerRow } = ROOM[entry.weight];
        const priceCents = PRICE_CENTS[entry.weight];
        const showtimeId = randomUUID();
        showtimeRows.push({ id: showtimeId, movieId, startsAt, priceCents, rows, seatsPerRow });

        const grid = emptyGrid(rows, seatsPerRow);
        const occupancy = targetOccupancy(
          entry.weight,
          startsAt,
          day,
          day === opensIn && opensIn > 0,
          `${movieId}|${startsAt.toISOString()}`,
        );
        const groups = fillSeats(grid, occupancy);
        const groupIds = groups.map(() => randomUUID());
        groups.forEach((size, i) =>
          reservationRows.push({
            id: groupIds[i]!,
            userId: boxOffice.id,
            showtimeId,
            totalCents: size * priceCents,
            createdAt: new Date(now.getTime() - Math.random() * 5 * 86_400_000),
          }),
        );
        for (let r = 0; r < rows; r++) {
          for (let n = 1; n <= seatsPerRow; n++) {
            const g = grid[r]![n - 1]!;
            const reservationId = g >= 0 ? groupIds[g]! : null;
            if (reservationId) stats.seatsPreSold++;
            seatRows.push({ showtimeId, row: rowLabel(r), number: n, reservationId });
          }
        }
      }
    }
  }

  if (showtimeRows.length) await prisma.showtime.createMany({ data: showtimeRows });
  for (const chunk of chunks(reservationRows, 5000)) await prisma.reservation.createMany({ data: chunk });
  for (const chunk of chunks(seatRows, 5000)) await prisma.seat.createMany({ data: chunk });
  stats.showtimesAdded = showtimeRows.length;

  // --- Top up sales on shows coming up soon -------------------------------
  stats.seatsToppedUp = await topUpSoonShowtimes(prisma, catalog, movieIdFor, boxOffice.id, today, now);

  // --- Clean up -----------------------------------------------------------
  const removed = await prisma.showtime.deleteMany({
    where: { startsAt: { lt: new Date(now.getTime() - KEEP_PAST_DAYS * 86_400_000) } },
  });
  stats.showtimesRemoved = removed.count;
  // Titles that left theaters disappear once their last showtime has aged out.
  // Hand-made admin movies (no tmdbId) are left alone.
  const retired = await prisma.movie.deleteMany({
    where: { id: { notIn: [...activeIds] }, tmdbId: { not: null }, showtimes: { none: {} } },
  });
  stats.moviesRetired = retired.count;

  return stats;
}

async function topUpSoonShowtimes(
  prisma: PrismaClient,
  catalog: CatalogMovie[],
  movieIdFor: Map<CatalogMovie, string>,
  boxOfficeId: string,
  today: string,
  now: Date,
) {
  const entryByMovie = new Map(catalog.map((e) => [movieIdFor.get(e)!, e]));
  const soon = await prisma.showtime.findMany({
    where: {
      movieId: { in: [...entryByMovie.keys()] },
      startsAt: { gt: now, lt: theaterTimeToDate(addDays(today, TOP_UP_DAYS)) },
    },
    select: {
      id: true,
      movieId: true,
      startsAt: true,
      priceCents: true,
      rows: true,
      seatsPerRow: true,
      seats: { select: { id: true, row: true, number: true, reservationId: true } },
    },
  });

  const reservations: Prisma.ReservationCreateManyInput[] = [];
  const assignments: { seatId: string; reservationId: string }[] = [];

  for (const st of soon) {
    const entry = entryByMovie.get(st.movieId)!;
    const day = daysBetween(today, theaterToday(st.startsAt));
    const opensIn = Math.max(0, daysBetween(today, entry.releaseDate));
    const target = targetOccupancy(
      entry.weight,
      st.startsAt,
      day,
      day === opensIn && opensIn > 0,
      `${st.movieId}|${st.startsAt.toISOString()}`,
    );

    const grid = emptyGrid(st.rows, st.seatsPerRow);
    const seatAt = new Map<string, string>();
    for (const s of st.seats) {
      const r = s.row.charCodeAt(0) - 65;
      if (s.reservationId) grid[r]![s.number - 1] = 1_000_000; // already sold (walk-in or real)
      seatAt.set(`${r}:${s.number - 1}`, s.id);
    }
    const before = new Set(st.seats.filter((s) => s.reservationId).map((s) => s.id));
    const groups = fillSeats(grid, target);
    if (!groups.length) continue;

    const groupIds = groups.map(() => randomUUID());
    groups.forEach((size, i) =>
      reservations.push({
        id: groupIds[i]!,
        userId: boxOfficeId,
        showtimeId: st.id,
        totalCents: size * st.priceCents,
      }),
    );
    grid.forEach((row, r) =>
      row.forEach((g, c) => {
        const seatId = seatAt.get(`${r}:${c}`);
        if (g >= 0 && g < groups.length && seatId && !before.has(seatId)) {
          assignments.push({ seatId, reservationId: groupIds[g]! });
        }
      }),
    );
  }

  for (const chunk of chunks(reservations, 5000)) await prisma.reservation.createMany({ data: chunk });
  // One UPDATE per chunk instead of one per seat
  for (const chunk of chunks(assignments, 2000)) {
    const values = Prisma.join(chunk.map((a) => Prisma.sql`(${a.seatId}, ${a.reservationId})`));
    await prisma.$executeRaw`
      UPDATE "Seat" AS s SET "reservationId" = v.rid
      FROM (VALUES ${values}) AS v(id, rid)
      WHERE s.id = v.id AND s."reservationId" IS NULL`;
  }
  return assignments.length;
}

// ---------------------------------------------------------------------------
// Fake demand
// ---------------------------------------------------------------------------

/**
 * Fraction of seats sold by now: bigger releases, evenings, weekends,
 * opening days, and sooner dates sell better. Jittered so no two match.
 */
export function targetOccupancy(
  weight: Weight,
  startsAt: Date,
  daysOut: number,
  openingDay: boolean,
  jitterKey: string,
) {
  const { hour, dow } = theaterClock(startsAt);
  let o = weight === "wide" ? 0.55 : weight === "solid" ? 0.4 : 0.25;
  o *= hour < 14 ? 0.5 : hour < 17 ? 0.75 : hour < 20 ? 1.2 : 1.0;
  if (dow === 5 || dow === 6) o *= 1.3;
  else if (dow === 0) o *= 1.15;
  if (openingDay) o *= 1.5;
  o *= Math.max(0.3, 1 - 0.06 * daysOut);
  // Per-showtime jitter that stays the same on every run, so re-running only
  // moves the target as the date gets closer — it never ratchets up randomly.
  o *= 0.7 + hashUnit(jitterKey) * 0.6;
  return Math.min(0.97, Math.max(0.02, o));
}

/** Deterministic number in [0, 1) from a string (FNV-1a). */
function hashUnit(key: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 2 ** 32;
}

function emptyGrid(rows: number, seatsPerRow: number) {
  return Array.from({ length: rows }, () => Array<number>(seatsPerRow).fill(-1));
}

/**
 * Seat parties of 1–5 together until the room reaches `occupancy`, favoring
 * middle-back rows and center seats. Cells already ≥ 0 count as taken.
 * New parties get indexes 0..n-1 in the grid; returns each party's size.
 */
export function fillSeats(grid: number[][], occupancy: number) {
  const rows = grid.length;
  const seatsPerRow = grid[0]?.length ?? 0;
  const groups: number[] = [];
  let taken = grid.flat().filter((g) => g >= 0).length;
  const target = Math.round(rows * seatsPerRow * occupancy);
  let misses = 0;

  while (taken < target && misses < 200) {
    const size = Math.min(target - taken, pickPartySize());
    const row = clampInt(Math.round(gaussian(rows * 0.6, rows * 0.3)), 0, rows - 1);
    const start = clampInt(
      Math.round(gaussian(seatsPerRow / 2, seatsPerRow / 3.5) - size / 2),
      0,
      seatsPerRow - size,
    );
    const seats = grid[row]!;
    if (seats.slice(start, start + size).some((g) => g >= 0)) {
      misses++;
      continue;
    }
    for (let i = start; i < start + size; i++) seats[i] = groups.length;
    groups.push(size);
    taken += size;
  }
  return groups;
}

function pickPartySize() {
  const r = Math.random();
  return r < 0.15 ? 1 : r < 0.6 ? 2 : r < 0.75 ? 3 : r < 0.95 ? 4 : 5;
}

function gaussian(mean: number, sd: number) {
  const u = 1 - Math.random();
  const v = Math.random();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clampInt(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function rowLabel(index: number) {
  return String.fromCharCode(65 + index);
}

function chunks<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
