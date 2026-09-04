# Movie Reservation API

Backend for a movie reservation service: auth with roles, movie/showtime management, seat booking with concurrency-safe reservations, and admin reporting.

## Stack

- Node.js + Express + TypeScript
- Prisma ORM + SQLite
- JWT auth (Bearer tokens)
- Zod request validation

## Web UI (Marquee)

Thin React client for the main user flow: sign in, browse showtimes by date, pick seats, view/cancel reservations.

### Development (two processes)

```bash
# terminal 1 — API
npm run dev

# terminal 2 — UI
npm run dev:client
```

Open **http://localhost:5174** (Vite proxies `/api` to the backend).

### Production-style (API serves the built UI)

```bash
npm run build:client
npm run dev   # or npm start after npm run build
```

Then open **http://localhost:3000**.

Demo login: `user@cinema.local` / `user12345`

**Marquee** is a fictional cinema. The **now-playing slate and time slots** are mirrored from public listings (e.g. AMC / showtimes.com) for demo purposes — not affiliated with any real chain.

## Data model (high level)

- **User** — `USER` or `ADMIN`
- **Movie** ↔ **Genre** (many-to-many)
- **Showtime** — belongs to a movie; owns a fixed seat grid (`rows` × `seatsPerRow`)
- **Seat** — unique `(showtimeId, row, number)`; `reservationId` null means available
- **Reservation** — confirmed/cancelled; seats freed on cancel

Seat booking runs in a transaction: load available seats → create reservation → claim seats only if still free. If another request wins a seat, the whole booking fails with `409`.

## API

All JSON. Authenticated routes need `Authorization: Bearer <token>`.

### Auth

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| POST | `/api/auth/signup` | Public | Create user |
| POST | `/api/auth/login` | Public | Login, get JWT |
| GET | `/api/auth/me` | Auth | Current user |
| PATCH | `/api/auth/users/:id/role` | Admin | Promote/demote (`{ "role": "ADMIN" \| "USER" }`) |

### Genres & movies

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | `/api/genres` | Public | List genres |
| POST | `/api/genres` | Admin | Create genre |
| GET | `/api/movies` | Public | List movies |
| GET | `/api/movies/:id` | Public | Movie + showtimes |
| POST | `/api/movies` | Admin | Create movie |
| PUT | `/api/movies/:id` | Admin | Update movie |
| DELETE | `/api/movies/:id` | Admin | Delete movie |

Movie body:

```json
{
  "title": "Inception",
  "description": "...",
  "posterUrl": "https://example.com/poster.jpg",
  "genreIds": ["<genreId>"]
}
```

### Showtimes

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | `/api/showtimes?date=YYYY-MM-DD` | Public | Movies/showtimes for a date |
| GET | `/api/showtimes/:id` | Public | Showtime + seat map |
| POST | `/api/showtimes` | Admin | Create showtime (generates seats) |
| PUT | `/api/showtimes/:id` | Admin | Update time/price |
| DELETE | `/api/showtimes/:id` | Admin | Delete if no reservations |

Create body:

```json
{
  "movieId": "...",
  "startsAt": "2026-07-24T19:00:00.000Z",
  "priceCents": 1500,
  "rows": 8,
  "seatsPerRow": 12
}
```

### Reservations

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| POST | `/api/reservations` | Auth | Reserve seats |
| GET | `/api/reservations/me` | Auth | My reservations |
| DELETE | `/api/reservations/:id` | Owner/Admin | Cancel upcoming reservation |
| GET | `/api/reservations` | Admin | All reservations (`?showtimeId=&status=`) |

Reserve body:

```json
{
  "showtimeId": "...",
  "seats": [{ "row": "A", "number": 5 }, { "row": "A", "number": 6 }]
}
```

### Admin reporting

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | `/api/admin/reports/summary` | Admin | Capacity, occupancy, revenue (`?date=YYYY-MM-DD` optional) |

## Example flow

```bash
# Login as user
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@cinema.local","password":"user12345"}' | jq -r .token)

# Browse showtimes for a date
curl -s "http://localhost:3000/api/showtimes?date=2026-07-23" | jq

# Inspect seats for a showtime
curl -s "http://localhost:3000/api/showtimes/<showtimeId>" | jq '.showtime.seats[:5]'

# Reserve
curl -s -X POST http://localhost:3000/api/reservations \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"showtimeId":"<id>","seats":[{"row":"A","number":1}]}' | jq
```

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start API with reload |
| `npm run build` / `npm start` | Production build |
| `npm run db:seed` | Seed admin, genres, sample movies/showtimes |
| `npm run db:reset` | Wipe DB, remigrate, reseed |
