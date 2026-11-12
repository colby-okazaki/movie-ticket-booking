import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";
import { fetchTmdbCatalog, syncCatalog } from "../src/lib/catalog.js";

const prisma = new PrismaClient();

/**
 * Full reset: demo logins, then a fresh lineup from TMDB's current US listings
 * with fictional showtimes and pre-sold seats. Wipes ALL movies, showtimes and
 * reservations. The daily cron (/api/cron/refresh-movies) keeps it current
 * afterwards without wiping anything.
 */
async function main() {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    throw new Error("TMDB_API_KEY is not set — get a free key at https://www.themoviedb.org/settings/api");
  }

  const demoPasswordHash = await bcrypt.hash("1234", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@cinema.local" },
    update: { passwordHash: demoPasswordHash },
    create: {
      email: "admin@cinema.local",
      name: "Cinema Admin",
      passwordHash: demoPasswordHash,
      role: Role.ADMIN,
    },
  });
  const demoUser = await prisma.user.upsert({
    where: { email: "user@cinema.local" },
    update: { passwordHash: demoPasswordHash },
    create: {
      email: "user@cinema.local",
      name: "Demo User",
      passwordHash: demoPasswordHash,
      role: Role.USER,
    },
  });

  await prisma.reservation.deleteMany();
  await prisma.seat.deleteMany();
  await prisma.showtime.deleteMany();
  await prisma.movieGenre.deleteMany();
  await prisma.movie.deleteMany();

  const catalog = await fetchTmdbCatalog(apiKey);
  const stats = await syncCatalog(prisma, catalog);

  console.log(
    `Seed complete — ${stats.titles} titles from TMDB, ${stats.showtimesAdded} showtimes, ` +
      `${stats.seatsPreSold} seats pre-sold`,
  );
  console.log(catalog.map((m) => `  ${m.weight.padEnd(7)} ${m.releaseDate}  ${m.title}`).join("\n"));
  console.log(`Admin: ${admin.email} / 1234`);
  console.log(`User:  ${demoUser.email} / 1234`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
