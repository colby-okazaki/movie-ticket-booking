import "dotenv/config";
import cors from "cors";
import express, { type RequestHandler } from "express";
import helmet from "helmet";
import path from "node:path";
import { existsSync } from "node:fs";
import { errorHandler } from "./lib/utils.js";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { cronRouter } from "./routes/cron.js";
import { genresRouter, moviesRouter } from "./routes/movies.js";
import { reservationsRouter } from "./routes/reservations.js";
import { showtimesRouter } from "./routes/showtimes.js";

// helmet/cors ship as CJS; Vercel's TS check rejects default-import call signatures under NodeNext.
const useHelmet = (helmet as unknown as (options?: object) => RequestHandler)({
  contentSecurityPolicy: false,
});
const useCors = (cors as unknown as () => RequestHandler)();

const app = express();
const clientDist = path.join(process.cwd(), "client", "dist");
const hasClientBuild = existsSync(clientDist);

app.use(useHelmet);
app.use(useCors);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/genres", genresRouter);
app.use("/api/movies", moviesRouter);
app.use("/api/showtimes", showtimesRouter);
app.use("/api/reservations", reservationsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/cron", cronRouter);

if (hasClientBuild) {
  app.use(express.static(clientDist));
  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith("/api") || req.path === "/health") {
      return next();
    }
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use(errorHandler);

export default app;
