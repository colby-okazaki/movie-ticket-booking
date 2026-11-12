import { timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { fetchTmdbCatalog, syncCatalog } from "../lib/catalog.js";
import { prisma } from "../lib/prisma.js";
import { AppError, asyncHandler } from "../lib/utils.js";

export const cronRouter = Router();

/**
 * Daily lineup refresh, triggered by Vercel Cron (see vercel.json).
 * Vercel sends `Authorization: Bearer $CRON_SECRET` automatically.
 */
cronRouter.get(
  "/refresh-movies",
  asyncHandler(async (req, res) => {
    const secret = process.env.CRON_SECRET;
    const apiKey = process.env.TMDB_API_KEY;
    if (!secret || !apiKey) throw new AppError(500, "CRON_SECRET and TMDB_API_KEY must be set");

    const given = Buffer.from(req.get("authorization") ?? "");
    const expected = Buffer.from(`Bearer ${secret}`);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw new AppError(401, "Unauthorized");
    }

    const started = Date.now();
    const catalog = await fetchTmdbCatalog(apiKey);
    const stats = await syncCatalog(prisma, catalog);
    res.json({ ok: true, ms: Date.now() - started, ...stats, lineup: catalog.map((m) => m.title) });
  }),
);
