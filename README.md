# Marquee — Movie Reservation

Full-stack cinema booking app with separate **User** and **Admin** experiences.

**Live site:** https://movie-reservation-app-black.vercel.app

## Demo logins

On the home page, pick **User** or **Admin**, then enter the password.

| Account | Email | Password |
|---------|-------|----------|
| User | `user@cinema.local` | `1234` |
| Admin | `admin@cinema.local` | `1234` |

- **User** — browse showtimes, pick seats, manage tickets  
- **Admin** — movies, showtimes, reservations, occupancy/revenue dashboard  

## Live movie lineup

The catalog mirrors what's actually in US theaters. A daily Vercel Cron job
(`/api/cron/refresh-movies`, see `vercel.json`) pulls TMDB's now-playing and
upcoming lists, adds new titles, keeps ~2 weeks of fictional showtimes rolling,
and "sells" seats to walk-ins as shows approach. Showtimes are on the theater's
clock (Pacific Time). Real customer reservations are never touched.

`npm run db:seed` does a full reset (wipes all reservations) and rebuilds the
lineup from TMDB.

Env vars: `TMDB_API_KEY` (free at https://www.themoviedb.org/settings/api) and
`CRON_SECRET` (any long random string; Vercel sends it to the cron route).

Movie data and posters from [TMDB](https://www.themoviedb.org). This product
uses the TMDB API but is not endorsed or certified by TMDB.

## Stack

TypeScript, Node.js, Express, Prisma, PostgreSQL, React, Vite, JWT

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
