import { ReservationStatus, Role } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { theaterDayRange } from "../lib/time.js";
import { asyncHandler } from "../lib/utils.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole(Role.ADMIN));

adminRouter.get(
  "/reports/summary",
  asyncHandler(async (req, res) => {
    const dateParam =
      typeof req.query.date === "string" ? req.query.date : undefined;

    let showtimeFilter: { startsAt?: { gte: Date; lt: Date } } = {};
    if (dateParam) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        res.status(400).json({ error: "Invalid date (YYYY-MM-DD)" });
        return;
      }
      showtimeFilter = {
        startsAt: {
          gte: theaterDayRange(dateParam).start,
          lt: theaterDayRange(dateParam).end,
        },
      };
    }

    const showtimes = await prisma.showtime.findMany({
      where: showtimeFilter,
      include: {
        movie: { select: { id: true, title: true } },
        seats: { select: { reservationId: true } },
        reservations: {
          where: { status: ReservationStatus.CONFIRMED },
          select: { totalCents: true, id: true },
        },
      },
      orderBy: { startsAt: "asc" },
    });

    const byShowtime = showtimes.map((st) => {
      const capacity = st.seats.length;
      const reservedSeats = st.seats.filter((s) => s.reservationId).length;
      const revenueCents = st.reservations.reduce((sum, r) => sum + r.totalCents, 0);

      return {
        showtimeId: st.id,
        startsAt: st.startsAt,
        movie: st.movie,
        capacity,
        reservedSeats,
        availableSeats: capacity - reservedSeats,
        occupancyRate: capacity === 0 ? 0 : reservedSeats / capacity,
        confirmedReservations: st.reservations.length,
        revenueCents,
      };
    });

    const totals = byShowtime.reduce(
      (acc, row) => {
        acc.capacity += row.capacity;
        acc.reservedSeats += row.reservedSeats;
        acc.confirmedReservations += row.confirmedReservations;
        acc.revenueCents += row.revenueCents;
        return acc;
      },
      {
        capacity: 0,
        reservedSeats: 0,
        confirmedReservations: 0,
        revenueCents: 0,
      },
    );

    res.json({
      filter: { date: dateParam ?? null },
      totals: {
        ...totals,
        availableSeats: totals.capacity - totals.reservedSeats,
        occupancyRate:
          totals.capacity === 0 ? 0 : totals.reservedSeats / totals.capacity,
      },
      showtimes: byShowtime,
    });
  }),
);
