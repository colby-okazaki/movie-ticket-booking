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

## Stack

TypeScript, Node.js, Express, Prisma, PostgreSQL, React, Vite, JWT

## Run locally

```bash
npm install
npm --prefix client install
cp .env.example .env   # set DATABASE_URL and JWT_SECRET
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
