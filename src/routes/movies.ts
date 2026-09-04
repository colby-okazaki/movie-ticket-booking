import { Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { AppError, asyncHandler, paramId, validateBody } from "../lib/utils.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const movieSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  posterUrl: z.string().url(),
  genreIds: z.array(z.string().min(1)).min(1),
});

const genreSchema = z.object({
  name: z.string().min(1).max(50),
});

export const moviesRouter = Router();
export const genresRouter = Router();

genresRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const genres = await prisma.genre.findMany({ orderBy: { name: "asc" } });
    res.json({ genres });
  }),
);

genresRouter.post(
  "/",
  requireAuth,
  requireRole(Role.ADMIN),
  validateBody(genreSchema),
  asyncHandler(async (req, res) => {
    const { name } = req.body as z.infer<typeof genreSchema>;
    const existing = await prisma.genre.findUnique({ where: { name } });
    if (existing) {
      throw new AppError(409, "Genre already exists");
    }
    const genre = await prisma.genre.create({ data: { name } });
    res.status(201).json({ genre });
  }),
);

moviesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const movies = await prisma.movie.findMany({
      include: {
        genres: { include: { genre: true } },
        showtimes: {
          where: { startsAt: { gte: new Date() } },
          orderBy: { startsAt: "asc" },
          take: 5,
        },
      },
      orderBy: { title: "asc" },
    });

    res.json({
      movies: movies.map((movie) => ({
        id: movie.id,
        title: movie.title,
        description: movie.description,
        posterUrl: movie.posterUrl,
        genres: movie.genres.map((g) => g.genre),
        upcomingShowtimes: movie.showtimes,
        createdAt: movie.createdAt,
        updatedAt: movie.updatedAt,
      })),
    });
  }),
);

moviesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = paramId(req.params.id);
    const movie = await prisma.movie.findUnique({
      where: { id },
      include: {
        genres: { include: { genre: true } },
        showtimes: { orderBy: { startsAt: "asc" } },
      },
    });
    if (!movie) {
      throw new AppError(404, "Movie not found");
    }

    res.json({
      movie: {
        id: movie.id,
        title: movie.title,
        description: movie.description,
        posterUrl: movie.posterUrl,
        genres: movie.genres.map((g) => g.genre),
        showtimes: movie.showtimes,
        createdAt: movie.createdAt,
        updatedAt: movie.updatedAt,
      },
    });
  }),
);

moviesRouter.post(
  "/",
  requireAuth,
  requireRole(Role.ADMIN),
  validateBody(movieSchema),
  asyncHandler(async (req, res) => {
    const data = req.body as z.infer<typeof movieSchema>;
    await assertGenresExist(data.genreIds);

    const movie = await prisma.movie.create({
      data: {
        title: data.title,
        description: data.description,
        posterUrl: data.posterUrl,
        genres: {
          create: data.genreIds.map((genreId) => ({ genreId })),
        },
      },
      include: { genres: { include: { genre: true } } },
    });

    res.status(201).json({
      movie: {
        ...movie,
        genres: movie.genres.map((g) => g.genre),
      },
    });
  }),
);

moviesRouter.put(
  "/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  validateBody(movieSchema),
  asyncHandler(async (req, res) => {
    const id = paramId(req.params.id);
    const data = req.body as z.infer<typeof movieSchema>;
    const existing = await prisma.movie.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, "Movie not found");
    }
    await assertGenresExist(data.genreIds);

    const movie = await prisma.$transaction(async (tx) => {
      await tx.movieGenre.deleteMany({ where: { movieId: id } });
      return tx.movie.update({
        where: { id },
        data: {
          title: data.title,
          description: data.description,
          posterUrl: data.posterUrl,
          genres: {
            create: data.genreIds.map((genreId) => ({ genreId })),
          },
        },
        include: { genres: { include: { genre: true } } },
      });
    });

    res.json({
      movie: {
        ...movie,
        genres: movie.genres.map((g) => g.genre),
      },
    });
  }),
);

moviesRouter.delete(
  "/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const id = paramId(req.params.id);
    const existing = await prisma.movie.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, "Movie not found");
    }

    await prisma.movie.delete({ where: { id } });
    res.status(204).send();
  }),
);

async function assertGenresExist(genreIds: string[]) {
  const genres = await prisma.genre.findMany({
    where: { id: { in: genreIds } },
  });
  if (genres.length !== genreIds.length) {
    throw new AppError(400, "One or more genreIds are invalid");
  }
}
