import { Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import {
  AppError,
  asyncHandler,
  paramId,
  rowLabel,
  seatKey,
  validateBody,
} from "../lib/utils.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const showtimeSchema = z.object({
  movieId: z.string().min(1),
  startsAt: z.string().datetime(),
  priceCents: z.number().int().positive(),
  rows: z.number().int().min(1).max(26),
  seatsPerRow: z.number().int().min(1).max(50),
});

export const showtimesRouter = Router();

showtimesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const dateParam = req.query.date;
    if (typeof dateParam !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      throw new AppError(400, "Query param 'date' is required (YYYY-MM-DD)");
    }

    const start = new Date(`${dateParam}T00:00:00.000Z`);
    const end = new Date(`${dateParam}T23:59:59.999Z`);

    const showtimes = await prisma.showtime.findMany({
      where: {
        startsAt: { gte: start, lte: end },
      },
      include: {
        movie: {
          include: { genres: { include: { genre: true } } },
        },
        seats: { select: { reservationId: true } },
      },
      orderBy: { startsAt: "asc" },
    });

    res.json({
      date: dateParam,
      showtimes: showtimes.map((st) => {
        const totalSeats = st.seats.length;
        const reservedSeats = st.seats.filter((s) => s.reservationId).length;
        return {
          id: st.id,
          startsAt: st.startsAt,
          priceCents: st.priceCents,
          rows: st.rows,
          seatsPerRow: st.seatsPerRow,
          capacity: totalSeats,
          availableSeats: totalSeats - reservedSeats,
          movie: {
            id: st.movie.id,
            title: st.movie.title,
            description: st.movie.description,
            posterUrl: st.movie.posterUrl,
            genres: st.movie.genres.map((g) => g.genre),
          },
        };
      }),
    });
  }),
);

showtimesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = paramId(req.params.id);
    const showtime = await prisma.showtime.findUnique({
      where: { id },
      include: {
        movie: {
          include: { genres: { include: { genre: true } } },
        },
        seats: {
          orderBy: [{ row: "asc" }, { number: "asc" }],
        },
      },
    });
    if (!showtime) {
      throw new AppError(404, "Showtime not found");
    }

    const seats = showtime.seats.map((seat) => ({
      id: seat.id,
      row: seat.row,
      number: seat.number,
      label: seatKey(seat.row, seat.number),
      available: seat.reservationId === null,
    }));

    res.json({
      showtime: {
        id: showtime.id,
        startsAt: showtime.startsAt,
        priceCents: showtime.priceCents,
        rows: showtime.rows,
        seatsPerRow: showtime.seatsPerRow,
        capacity: seats.length,
        availableSeats: seats.filter((s) => s.available).length,
        movie: {
          id: showtime.movie.id,
          title: showtime.movie.title,
          description: showtime.movie.description,
          posterUrl: showtime.movie.posterUrl,
          genres: showtime.movie.genres.map((g) => g.genre),
        },
        seats,
      },
    });
  }),
);

showtimesRouter.post(
  "/",
  requireAuth,
  requireRole(Role.ADMIN),
  validateBody(showtimeSchema),
  asyncHandler(async (req, res) => {
    const data = req.body as z.infer<typeof showtimeSchema>;
    const movie = await prisma.movie.findUnique({ where: { id: data.movieId } });
    if (!movie) {
      throw new AppError(404, "Movie not found");
    }

    const startsAt = new Date(data.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      throw new AppError(400, "Invalid startsAt");
    }
    if (startsAt <= new Date()) {
      throw new AppError(400, "Showtime must be in the future");
    }

    const seatData = buildSeatGrid(data.rows, data.seatsPerRow);

    const showtime = await prisma.showtime.create({
      data: {
        movieId: data.movieId,
        startsAt,
        priceCents: data.priceCents,
        rows: data.rows,
        seatsPerRow: data.seatsPerRow,
        seats: { create: seatData },
      },
      include: {
        movie: true,
        seats: { select: { id: true } },
      },
    });

    res.status(201).json({
      showtime: {
        id: showtime.id,
        movieId: showtime.movieId,
        movie: showtime.movie,
        startsAt: showtime.startsAt,
        priceCents: showtime.priceCents,
        rows: showtime.rows,
        seatsPerRow: showtime.seatsPerRow,
        capacity: showtime.seats.length,
      },
    });
  }),
);

showtimesRouter.put(
  "/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  validateBody(
    showtimeSchema.pick({ startsAt: true, priceCents: true }),
  ),
  asyncHandler(async (req, res) => {
    const id = paramId(req.params.id);
    const existing = await prisma.showtime.findUnique({
      where: { id },
      include: { seats: { where: { reservationId: { not: null } }, take: 1 } },
    });
    if (!existing) {
      throw new AppError(404, "Showtime not found");
    }

    const { startsAt, priceCents } = req.body as {
      startsAt: string;
      priceCents: number;
    };
    const nextStartsAt = new Date(startsAt);
    if (Number.isNaN(nextStartsAt.getTime())) {
      throw new AppError(400, "Invalid startsAt");
    }
    if (nextStartsAt <= new Date()) {
      throw new AppError(400, "Showtime must be in the future");
    }

    const showtime = await prisma.showtime.update({
      where: { id },
      data: { startsAt: nextStartsAt, priceCents },
      include: { movie: true },
    });

    res.json({ showtime });
  }),
);

showtimesRouter.delete(
  "/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const id = paramId(req.params.id);
    const existing = await prisma.showtime.findUnique({
      where: { id },
      include: {
        seats: { where: { reservationId: { not: null } }, take: 1 },
      },
    });
    if (!existing) {
      throw new AppError(404, "Showtime not found");
    }
    if (existing.seats.length > 0) {
      throw new AppError(409, "Cannot delete a showtime with existing reservations");
    }

    await prisma.showtime.delete({ where: { id } });
    res.status(204).send();
  }),
);

function buildSeatGrid(rows: number, seatsPerRow: number) {
  const seats: { row: string; number: number }[] = [];
  for (let r = 0; r < rows; r++) {
    const label = rowLabel(r);
    for (let n = 1; n <= seatsPerRow; n++) {
      seats.push({ row: label, number: n });
    }
  }
  return seats;
}
