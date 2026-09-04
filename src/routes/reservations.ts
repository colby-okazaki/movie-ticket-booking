import { ReservationStatus, Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import {
  AppError,
  asyncHandler,
  paramId,
  seatKey,
  validateBody,
} from "../lib/utils.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const createReservationSchema = z.object({
  showtimeId: z.string().min(1),
  seats: z
    .array(
      z.object({
        row: z.string().min(1),
        number: z.number().int().positive(),
      }),
    )
    .min(1)
    .max(10),
});

export const reservationsRouter = Router();

reservationsRouter.post(
  "/",
  requireAuth,
  validateBody(createReservationSchema),
  asyncHandler(async (req, res) => {
    const { showtimeId, seats } = req.body as z.infer<typeof createReservationSchema>;
    const userId = req.user!.userId;

    const uniqueKeys = new Set(seats.map((s) => seatKey(s.row, s.number)));
    if (uniqueKeys.size !== seats.length) {
      throw new AppError(400, "Duplicate seats in request");
    }

    const showtime = await prisma.showtime.findUnique({
      where: { id: showtimeId },
      include: { movie: true },
    });
    if (!showtime) {
      throw new AppError(404, "Showtime not found");
    }
    if (showtime.startsAt <= new Date()) {
      throw new AppError(400, "Cannot reserve seats for a past showtime");
    }

    const reservation = await prisma.$transaction(async (tx) => {
      const available = await tx.seat.findMany({
        where: {
          showtimeId,
          reservationId: null,
          OR: seats.map((s) => ({ row: s.row, number: s.number })),
        },
      });

      if (available.length !== seats.length) {
        throw new AppError(409, "One or more seats are unavailable");
      }

      const totalCents = showtime.priceCents * seats.length;
      const created = await tx.reservation.create({
        data: {
          userId,
          showtimeId,
          totalCents,
          status: ReservationStatus.CONFIRMED,
        },
      });

      const updated = await tx.seat.updateMany({
        where: {
          id: { in: available.map((s) => s.id) },
          reservationId: null,
        },
        data: { reservationId: created.id },
      });

      if (updated.count !== seats.length) {
        throw new AppError(409, "One or more seats were just taken");
      }

      return tx.reservation.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          seats: true,
          showtime: { include: { movie: true } },
        },
      });
    });

    res.status(201).json({ reservation: formatReservation(reservation) });
  }),
);

reservationsRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const reservations = await prisma.reservation.findMany({
      where: { userId: req.user!.userId },
      include: {
        seats: true,
        showtime: { include: { movie: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ reservations: reservations.map(formatReservation) });
  }),
);

reservationsRouter.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = paramId(req.params.id);
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: { showtime: true },
    });
    if (!reservation) {
      throw new AppError(404, "Reservation not found");
    }
    if (reservation.userId !== req.user!.userId && req.user!.role !== Role.ADMIN) {
      throw new AppError(403, "Not allowed to cancel this reservation");
    }
    if (reservation.status === ReservationStatus.CANCELLED) {
      throw new AppError(400, "Reservation is already cancelled");
    }
    if (reservation.showtime.startsAt <= new Date()) {
      throw new AppError(400, "Only upcoming reservations can be cancelled");
    }

    const cancelled = await prisma.$transaction(async (tx) => {
      await tx.seat.updateMany({
        where: { reservationId: reservation.id },
        data: { reservationId: null },
      });

      return tx.reservation.update({
        where: { id: reservation.id },
        data: {
          status: ReservationStatus.CANCELLED,
          cancelledAt: new Date(),
        },
        include: {
          seats: true,
          showtime: { include: { movie: true } },
        },
      });
    });

    res.json({ reservation: formatReservation(cancelled) });
  }),
);

reservationsRouter.get(
  "/",
  requireAuth,
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const showtimeId =
      typeof req.query.showtimeId === "string" ? req.query.showtimeId : undefined;
    const status =
      typeof req.query.status === "string"
        ? (req.query.status as ReservationStatus)
        : undefined;

    if (status && !Object.values(ReservationStatus).includes(status)) {
      throw new AppError(400, "Invalid status filter");
    }

    const reservations = await prisma.reservation.findMany({
      where: {
        ...(showtimeId ? { showtimeId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
        seats: true,
        showtime: { include: { movie: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      reservations: reservations.map((r) => ({
        ...formatReservation(r),
        user: r.user,
      })),
    });
  }),
);

function formatReservation(reservation: {
  id: string;
  userId: string;
  showtimeId: string;
  status: ReservationStatus;
  totalCents: number;
  createdAt: Date;
  cancelledAt: Date | null;
  seats: { row: string; number: number }[];
  showtime: {
    id: string;
    startsAt: Date;
    priceCents: number;
    movie: { id: string; title: string; posterUrl: string };
  };
}) {
  return {
    id: reservation.id,
    userId: reservation.userId,
    status: reservation.status,
    totalCents: reservation.totalCents,
    createdAt: reservation.createdAt,
    cancelledAt: reservation.cancelledAt,
    seats: reservation.seats.map((s) => ({
      row: s.row,
      number: s.number,
      label: seatKey(s.row, s.number),
    })),
    showtime: {
      id: reservation.showtime.id,
      startsAt: reservation.showtime.startsAt,
      priceCents: reservation.showtime.priceCents,
      movie: reservation.showtime.movie,
    },
  };
}
