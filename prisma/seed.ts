import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Catalog mirrored from public “now playing” listings (AMC / showtimes.com)
 * as of late July 2026. Marquee is a fictional theater — not affiliated with
 * any real chain. Showtimes follow common multiplex slot patterns.
 */
const MOVIES: {
  title: string;
  description: string;
  posterUrl: string;
  genres: string[];
  /** Typical multiplex slots for this title (local-style evening-heavy) */
  slots: string[];
  /** How many screens / days this title dominates */
  weight: "wide" | "solid" | "limited";
}[] = [
  {
    title: "Spider-Man: Brand New Day",
    description:
      "Four years after the world forgot Peter Parker, he lives alone and fights crime full-time as Spider-Man in a city that no longer knows his name.",
    posterUrl: "https://image.tmdb.org/t/p/w500/6Q21yptoOCUq4ErwVncesLPVplb.jpg",
    genres: ["Action", "Adventure", "Sci-Fi"],
    slots: ["12:30", "15:45", "18:30", "21:15"],
    weight: "wide",
  },
  {
    title: "The Odyssey",
    description:
      "Christopher Nolan’s mythic action epic: Odysseus embarks on a perilous journey home after the Trojan War, facing gods, monsters, and trials that stretch his cunning and humanity.",
    posterUrl: "https://image.tmdb.org/t/p/w500/5rhTDKUhPYvpdQIijFIs5VoWsON.jpg",
    genres: ["Action", "Adventure", "Drama"],
    slots: ["10:30", "14:15", "18:00", "21:45"],
    weight: "wide",
  },
  {
    title: "Moana",
    description:
      "Teenage Moana answers the Ocean’s call and voyages beyond the reef of Motunui with demigod Maui on a journey to restore prosperity to her people.",
    posterUrl: "https://image.tmdb.org/t/p/w500/zKVgiv5qHCvCLT4A2ymJi5QeXDH.jpg",
    genres: ["Adventure", "Family", "Fantasy"],
    slots: ["11:00", "13:40", "16:20", "19:00"],
    weight: "wide",
  },
  {
    title: "Toy Story 5",
    description:
      "Woody, Buzz, and the gang return for a new adventure as toys navigate friendship, change, and what it means to be there for a kid.",
    posterUrl: "https://image.tmdb.org/t/p/w500/sfQtVlIHljToOwYjhe21KPGzZWK.jpg",
    genres: ["Animation", "Comedy", "Family"],
    slots: ["10:15", "12:50", "15:30", "18:10"],
    weight: "wide",
  },
  {
    title: "Minions & Monsters",
    description:
      "The Minions collide with a new cast of monsters in a chaotic, family-friendly adventure straight from the Despicable Me universe.",
    posterUrl: "https://image.tmdb.org/t/p/w500/nz7i42yhLIJ4ve9JKgM6NthoLHO.jpg",
    genres: ["Animation", "Comedy", "Family"],
    slots: ["10:45", "13:15", "15:50", "18:25"],
    weight: "solid",
  },
  {
    title: "Evil Dead Burn",
    description:
      "A new nightmare in the Evil Dead saga as survivors confront Deadites and the price of opening the wrong book.",
    posterUrl: "https://image.tmdb.org/t/p/w500/ztadKzIIR0ERYqpHteaPFtk7inP.jpg",
    genres: ["Horror", "Thriller"],
    slots: ["16:45", "19:30", "22:15"],
    weight: "solid",
  },
  {
    title: "Young Washington",
    description:
      "A formative chapter in George Washington’s life—ambition, war, and the making of a future founder.",
    posterUrl: "https://image.tmdb.org/t/p/w500/ntW9zzhDmbt3sXDyPXb7SHVuDdB.jpg",
    genres: ["Drama", "History"],
    slots: ["13:00", "16:00", "19:15"],
    weight: "solid",
  },
  {
    title: "Supergirl",
    description:
      "When a ruthless adversary strikes too close to home, Kara Zor-El reluctantly joins forces with an unlikely companion on an interstellar journey of vengeance and justice.",
    posterUrl: "https://image.tmdb.org/t/p/w500/niSvU02l2BONH9ivubV6K1a5QiK.jpg",
    genres: ["Action", "Adventure", "Sci-Fi"],
    slots: ["12:00", "14:45", "17:30", "20:30"],
    weight: "wide",
  },
  {
    title: "The Invite",
    description:
      "Joe and Angela’s marriage is on thin ice. When they invite their enigmatic upstairs neighbors for dinner, the night spirals into unexpected places.",
    posterUrl: "https://image.tmdb.org/t/p/w500/b7Dr8Chzse8VagexAporUu2RtLx.jpg",
    genres: ["Thriller", "Drama"],
    slots: ["15:00", "17:45", "20:45"],
    weight: "limited",
  },
  {
    title: "Obsession",
    description:
      "After breaking the mysterious One Wish Willow to win his crush’s heart, a hopeless romantic gets exactly what he asked for—and discovers some desires come at a dark price.",
    posterUrl: "https://image.tmdb.org/t/p/w500/bRwnj8WEKBCvmfeUNOukJPwB43K.jpg",
    genres: ["Horror", "Thriller", "Romance"],
    slots: ["14:30", "17:15", "21:00"],
    weight: "limited",
  },
  {
    title: "Disclosure Day",
    description:
      "A high-stakes thriller timed to a day when secrets can no longer stay buried.",
    posterUrl: "https://image.tmdb.org/t/p/w500/AnJ8IQJI23hNpYXVNaythu061Ru.jpg",
    genres: ["Thriller", "Drama"],
    slots: ["16:10", "19:00", "21:50"],
    weight: "limited",
  },
  {
    title: "Motor City",
    description:
      "In 1970s Detroit, John Miller falls for a gangster’s girl and lands in prison for a crime he didn’t commit—then plots revenge against the man who ruined his life.",
    posterUrl: "https://image.tmdb.org/t/p/w500/lGovcOtxugJPhfJjFKud9EbWtOA.jpg",
    genres: ["Action", "Crime", "Drama"],
    slots: ["15:20", "18:05", "20:50"],
    weight: "limited",
  },
  {
    title: "Hadestown: The Musical",
    description:
      "The tragic love of Orpheus and Eurydice intertwines with Hades and Persephone in this filmed stage musical of the Broadway hit.",
    posterUrl: "https://image.tmdb.org/t/p/w500/iJNVygzkuOSCOdCPNI1nLSeF7sz.jpg",
    genres: ["Music", "Drama", "Fantasy"],
    slots: ["14:00", "19:45"],
    weight: "limited",
  },
  {
    title: "Superman",
    description:
      "Clark Kent embarks on a journey to reconcile his Kryptonian heritage with his human upbringing as Superman faces new threats to Metropolis.",
    posterUrl: "https://image.tmdb.org/t/p/w500/ldyfo0BKmz5rWtJJKCvwaNS4cJT.jpg",
    genres: ["Action", "Adventure", "Sci-Fi"],
    slots: ["13:30", "17:00", "20:15"],
    weight: "solid",
  },
];

async function main() {
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

  const genreNames = [...new Set(MOVIES.flatMap((m) => m.genres))];
  const genreByName: Record<string, { id: string; name: string }> = {};
  for (const name of genreNames) {
    genreByName[name] = await prisma.genre.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const daySpan = (weight: "wide" | "solid" | "limited") => {
    const end = weight === "wide" ? 13 : weight === "solid" ? 9 : 6;
    return Array.from({ length: end + 1 }, (_, i) => i);
  };

  const prices: Record<"wide" | "solid" | "limited", number> = {
    wide: 1699,
    solid: 1549,
    limited: 1399,
  };

  for (const movie of MOVIES) {
    const created = await prisma.movie.create({
      data: {
        title: movie.title,
        description: movie.description,
        posterUrl: movie.posterUrl,
        genres: {
          create: movie.genres.map((name) => ({
            genreId: genreByName[name]!.id,
          })),
        },
      },
    });

    for (const dayOffset of daySpan(movie.weight)) {
      for (const slot of movie.slots) {
        const startsAt = wallClockUtc(dayOffset, slot);
        // Skip slots that already started today
        if (startsAt <= new Date()) continue;
        await createShowtime(
          created.id,
          startsAt,
          prices[movie.weight],
          movie.weight === "wide" ? 10 : 8,
          movie.weight === "wide" ? 14 : 12,
        );
      }
    }
  }

  const showCount = await prisma.showtime.count();
  console.log(
    `Seed complete — ${MOVIES.length} now-playing titles, ${showCount} showtimes (mirrored public listings → fictional Marquee)`,
  );
  console.log(`Admin: ${admin.email} / 1234`);
  console.log(`User:  ${demoUser.email} / 1234`);
}

/** Build a Date for local-style HH:mm on UTC calendar day offset from today. */
function wallClockUtc(dayOffset: number, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + dayOffset);
  d.setUTCHours(h ?? 0, m ?? 0, 0, 0);
  return d;
}

async function createShowtime(
  movieId: string,
  startsAt: Date,
  priceCents: number,
  rows: number,
  seatsPerRow: number,
) {
  const seats = [];
  for (let r = 0; r < rows; r++) {
    const row = String.fromCharCode(65 + r);
    for (let n = 1; n <= seatsPerRow; n++) {
      seats.push({ row, number: n });
    }
  }

  return prisma.showtime.create({
    data: {
      movieId,
      startsAt,
      priceCents,
      rows,
      seatsPerRow,
      seats: { create: seats },
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
