export type Role = "USER" | "ADMIN";

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
};

export type Genre = { id: string; name: string };

export type Movie = {
  id: string;
  title: string;
  description: string;
  posterUrl: string;
  genres: Genre[];
};

export type ShowtimeSummary = {
  id: string;
  startsAt: string;
  priceCents: number;
  rows: number;
  seatsPerRow: number;
  capacity: number;
  availableSeats: number;
  movie: Movie;
};

export type Seat = {
  id: string;
  row: string;
  number: number;
  label: string;
  available: boolean;
};

export type ShowtimeDetail = ShowtimeSummary & {
  seats: Seat[];
};

export type Reservation = {
  id: string;
  userId: string;
  status: "CONFIRMED" | "CANCELLED";
  totalCents: number;
  createdAt: string;
  cancelledAt: string | null;
  seats: { row: string; number: number; label: string }[];
  showtime: {
    id: string;
    startsAt: string;
    priceCents: number;
    movie: { id: string; title: string; posterUrl: string };
  };
};

type ApiError = { error: string; details?: unknown };

async function request<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(path, { ...init, headers });
  if (res.status === 204) {
    return undefined as T;
  }

  const data = (await res.json().catch(() => ({}))) as T & ApiError;
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  signup: (body: { email: string; password: string; name: string }) =>
    request<{ user: User; token: string }>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  login: (body: { email: string; password: string }) =>
    request<{ user: User; token: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  me: (token: string) => request<{ user: User }>("/api/auth/me", {}, token),

  showtimesByDate: (date: string) =>
    request<{ date: string; showtimes: ShowtimeSummary[] }>(
      `/api/showtimes?date=${encodeURIComponent(date)}`,
    ),

  showtime: (id: string) =>
    request<{ showtime: ShowtimeDetail }>(`/api/showtimes/${id}`),

  reserve: (
    token: string,
    body: { showtimeId: string; seats: { row: string; number: number }[] },
  ) =>
    request<{ reservation: Reservation }>(
      "/api/reservations",
      { method: "POST", body: JSON.stringify(body) },
      token,
    ),

  myReservations: (token: string) =>
    request<{ reservations: Reservation[] }>("/api/reservations/me", {}, token),

  cancelReservation: (token: string, id: string) =>
    request<{ reservation: Reservation }>(
      `/api/reservations/${id}`,
      { method: "DELETE" },
      token,
    ),

  genres: () => request<{ genres: Genre[] }>("/api/genres"),

  movies: () =>
    request<{ movies: MovieCatalogEntry[] }>("/api/movies"),

  createGenre: (token: string, body: { name: string }) =>
    request<{ genre: Genre }>(
      "/api/genres",
      { method: "POST", body: JSON.stringify(body) },
      token,
    ),

  createMovie: (
    token: string,
    body: { title: string; description: string; posterUrl: string; genreIds: string[] },
  ) =>
    request<{ movie: MovieCatalogEntry }>(
      "/api/movies",
      { method: "POST", body: JSON.stringify(body) },
      token,
    ),

  updateMovie: (
    token: string,
    id: string,
    body: { title: string; description: string; posterUrl: string; genreIds: string[] },
  ) =>
    request<{ movie: MovieCatalogEntry }>(
      `/api/movies/${id}`,
      { method: "PUT", body: JSON.stringify(body) },
      token,
    ),

  deleteMovie: (token: string, id: string) =>
    request<void>(`/api/movies/${id}`, { method: "DELETE" }, token),

  createShowtime: (
    token: string,
    body: {
      movieId: string;
      startsAt: string;
      priceCents: number;
      rows: number;
      seatsPerRow: number;
    },
  ) =>
    request<{ showtime: AdminShowtime }>(
      "/api/showtimes",
      { method: "POST", body: JSON.stringify(body) },
      token,
    ),

  updateShowtime: (
    token: string,
    id: string,
    body: { startsAt: string; priceCents: number },
  ) =>
    request<{ showtime: AdminShowtime }>(
      `/api/showtimes/${id}`,
      { method: "PUT", body: JSON.stringify(body) },
      token,
    ),

  deleteShowtime: (token: string, id: string) =>
    request<void>(`/api/showtimes/${id}`, { method: "DELETE" }, token),

  allReservations: (
    token: string,
    params?: { showtimeId?: string; status?: "CONFIRMED" | "CANCELLED" },
  ) => {
    const qs = new URLSearchParams();
    if (params?.showtimeId) qs.set("showtimeId", params.showtimeId);
    if (params?.status) qs.set("status", params.status);
    const query = qs.toString();
    return request<{ reservations: AdminReservation[] }>(
      `/api/reservations${query ? `?${query}` : ""}`,
      {},
      token,
    );
  },

  reportSummary: (token: string, date?: string) => {
    const qs = date ? `?date=${encodeURIComponent(date)}` : "";
    return request<ReportSummary>(`/api/admin/reports/summary${qs}`, {}, token);
  },
};

export type MovieCatalogEntry = Movie & {
  upcomingShowtimes?: { id: string; startsAt: string; priceCents: number }[];
};

export type AdminShowtime = {
  id: string;
  movieId?: string;
  startsAt: string;
  priceCents: number;
  rows: number;
  seatsPerRow: number;
  capacity?: number;
  movie?: { id: string; title: string };
};

export type AdminReservation = Reservation & {
  user: { id: string; email: string; name: string };
};

export type ReportSummary = {
  filter: { date: string | null };
  totals: {
    capacity: number;
    reservedSeats: number;
    availableSeats: number;
    occupancyRate: number;
    confirmedReservations: number;
    revenueCents: number;
  };
  showtimes: {
    showtimeId: string;
    startsAt: string;
    movie: { id: string; title: string };
    capacity: number;
    reservedSeats: number;
    availableSeats: number;
    occupancyRate: number;
    confirmedReservations: number;
    revenueCents: number;
  }[];
};

export function formatMoney(cents: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function formatShowtime(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function todayUtcDate() {
  return new Date().toISOString().slice(0, 10);
}

export function homePathForRole(role: Role) {
  return role === "ADMIN" ? "/admin" : "/browse";
}

export function toLocalDatetimeInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function localDatetimeToIso(local: string) {
  return new Date(local).toISOString();
}

export function formatPercent(rate: number) {
  return `${Math.round(rate * 100)}%`;
}
