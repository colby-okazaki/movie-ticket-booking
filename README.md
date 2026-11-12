# Marquee — Movie Reservation

Full-stack cinema booking app for a fictional theater, with separate **User** and
**Admin** experiences. The lineup tracks what's actually playing in US theaters
and refreshes itself every day.

**Live site:** https://movie-reservation-app-black.vercel.app

## Demo logins

On the home page, pick **User** or **Admin**, then enter the password.

| Account | Email | Password |
|---------|-------|----------|
| User | `user@cinema.local` | `1234` |
| Admin | `admin@cinema.local` | `1234` |

- **User** — browse showtimes by date, pick seats on a live seat map, manage tickets
- **Admin** — movies, showtimes, reservations, occupancy/revenue dashboard

## Features

- **Real, self-updating lineup.** A daily Vercel Cron job pulls TMDB's US
  now-playing and upcoming lists. A title qualifies only with a real US
  theatrical release in the last ~10 weeks or next 10 days (anniversary
  re-releases are skipped), and upcoming films first get showtimes on opening day.
- **Multiplex-style scheduling.** Each title's screen count is scored from
  budget and popularity; limited releases and films already out on digital get
  fewer shows. Showtimes are fictional but follow real patterns — family films
  run matinees, horror runs late — and stay consistent day to day.
- **Believable demand.** Seats are pre-sold to walk-in parties of 1–5 who sit
  together, favoring middle-back rows. Evenings, weekends, opening nights and
  bigger releases sell more, and shows keep selling as they approach.
- **Safe, repeatable sync.** The refresh is idempotent: it adds only missing
  titles and showtimes, never touches real customers' reservations, and prunes
  week-old showtimes and titles that have left theaters, so the database stays
  a steady size.
- **One theater clock.** All showtimes are on Pacific Time (DST-safe), whatever
  the viewer's time zone.
- **Seat booking.** Transactional reservations prevent double-booking; users can
  cancel upcoming tickets.

## How the daily refresh works

`GET /api/cron/refresh-movies` (scheduled in `vercel.json`, daily at 11:00 UTC)
→ `fetchTmdbCatalog` builds the lineup → `syncCatalog` upserts movies, fills a
rolling ~2-week showtime window, tops up sales on the next 3 days of shows, and
cleans up. Vercel authenticates the call with `Authorization: Bearer $CRON_SECRET`.
Code: [`src/lib/catalog.ts`](src/lib/catalog.ts), [`src/routes/cron.ts`](src/routes/cron.ts).

`npm run db:seed` runs the same sync after a **full reset** — it wipes all
movies, showtimes and reservations.

## Stack

TypeScript, Node.js, Express, Prisma, PostgreSQL, React, Vite, JWT, Vercel
(Functions + Cron), TMDB API

## Run locally

```bash
npm install
npm --prefix client install
cp .env.example .env   # set DATABASE_URL, JWT_SECRET, TMDB_API_KEY, CRON_SECRET
npm run db:push
npm run db:seed
npm run build:client
npm run dev
```

Open http://localhost:3000

Or run API and UI separately:

```bash
npm run dev          # API on :3000
npm run dev:client   # UI on :5174
```

| Env var | Purpose |
|---------|---------|
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET` | Signs login tokens |
| `TMDB_API_KEY` | TMDB v3 API key — free at https://www.themoviedb.org/settings/api |
| `CRON_SECRET` | Any long random string; guards the cron route |

To trigger a refresh by hand:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/refresh-movies
```

## Deploying

The Vercel project isn't connected to GitHub, so pushing doesn't deploy. Run:

```bash
vercel deploy --prod
```

Schema changes need `npx prisma db push` against the production database first.

## Credits

Movie data and posters from [TMDB](https://www.themoviedb.org). This product
uses the TMDB API but is not endorsed or certified by TMDB.
