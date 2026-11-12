import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Catalog mirrored from public “now playing” listings (Rotten Tomatoes / TMDB)
 * as of mid-November 2026. Marquee is a fictional theater — not affiliated with
 * any real chain. Showtimes are made up and follow common multiplex slot patterns.
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
  /** Days from seed date until the title opens (for upcoming releases) */
  opensInDays?: number;
}[] = [
  {
    title: "Godzilla Minus Zero",
    description:
      "Two years after Godzilla plunged a war-ravaged Japan into despair, the country has finally clawed back a fragile peace—until a new threat strikes and crushes hope in an instant.",
    posterUrl: "https://image.tmdb.org/t/p/w500/hSmIJluOJmTWvJs4d7kHRxjc8s8.jpg",
    genres: ["Action", "Sci-Fi", "Drama"],
    slots: ["11:30", "14:45", "18:00", "21:15"],
    weight: "wide",
  },
  {
    title: "The Cat in the Hat",
    description:
      "Assigned his toughest mission yet, the Cat must cheer up siblings Gabby and Sebastian as they adjust to life in a new town—or risk losing his magical hat forever.",
    posterUrl: "https://image.tmdb.org/t/p/w500/mWN6knIVJ2o7eGwSm7mOgSCwNUc.jpg",
    genres: ["Animation", "Comedy", "Family"],
    slots: ["10:15", "12:40", "15:10", "17:35"],
    weight: "wide",
  },
  {
    title: "Ebenezer",
    description:
      "An elderly miser is visited by the ghost of his former partner and the Spirits of Christmas Past, Present, and Yet to Come, forcing him to confront his past and fight for a second chance.",
    posterUrl: "https://image.tmdb.org/t/p/w500/6H2N59jJW1hZEzn2ZdrMvJw5vNI.jpg",
    genres: ["Drama", "Fantasy", "Family"],
    slots: ["12:00", "15:00", "18:15", "21:00"],
    weight: "wide",
    opensInDays: 1,
  },
  {
    title: "The Hunger Games: Sunrise on the Reaping",
    description:
      "Return to Panem 24 years before The Hunger Games, starting on the morning of the reaping for the 50th Games—the Second Quarter Quell.",
    posterUrl: "https://image.tmdb.org/t/p/w500/j1MNyNNgNQL6f27cb3m3uKaPKd6.jpg",
    genres: ["Action", "Adventure", "Sci-Fi"],
    slots: ["12:15", "15:45", "19:00", "22:15"],
    weight: "wide",
    opensInDays: 8,
  },
  {
    title: "Wild Horse Nine",
    description:
      "Shortly before the 1973 Chilean coup, two CIA agents are sent to Easter Island, where their dark pasts, present conspiracies, and a bond with two rebellious students threaten to send the trip sideways.",
    posterUrl: "https://image.tmdb.org/t/p/w500/dNJFRtVg3xLQ7dbNIQ55cmmIniD.jpg",
    genres: ["Comedy", "Thriller"],
    slots: ["13:20", "16:30", "19:40", "22:20"],
    weight: "solid",
  },
  {
    title: "Ramayana: Rise of a Legend",
    description:
      "An ancient epic follows a young prince and princess whose marriage and exile mark the beginning of a legendary journey of love, duty, and destiny.",
    posterUrl: "https://image.tmdb.org/t/p/w500/vBQ7wks68OhJKlb3RnXSl2yXBXK.jpg",
    genres: ["Action", "Adventure", "Fantasy"],
    slots: ["13:00", "17:00", "20:45"],
    weight: "solid",
  },
  {
    title: "How to Rob a Bank",
    description:
      "A crew of social-media-savvy bank robbers livestreams their heists—unaware their viral fame has put them in the crosshairs of a veteran FBI agent and a brilliant software engineer.",
    posterUrl: "https://image.tmdb.org/t/p/w500/ifYDZkr2qkHFz87TNVvlxajOxl5.jpg",
    genres: ["Action", "Crime", "Thriller"],
    slots: ["14:00", "17:10", "20:20"],
    weight: "solid",
    opensInDays: 1,
  },
  {
    title: "Clayface",
    description:
      "Gotham street kid turned Hollywood star Matt Hagen is horribly disfigured by a crime boss—and the experimental treatment that restores him also loosens his grip on reality.",
    posterUrl: "https://image.tmdb.org/t/p/w500/9l1NuFjel2j89hiuiJbsxfblqjy.jpg",
    genres: ["Horror", "Crime", "Thriller"],
    slots: ["16:00", "19:10", "22:00"],
    weight: "solid",
  },
  {
    title: "Wildwood",
    description:
      "Prue and her classmate Curtis are drawn into a magical forest on a desperate quest to rescue Prue’s baby brother from a murder of crows led by the mysterious Alexandra.",
    posterUrl: "https://image.tmdb.org/t/p/w500/snFM00mpNAfUzUtkdEW0uDEvXA0.jpg",
    genres: ["Animation", "Adventure", "Family"],
    slots: ["10:45", "13:30", "16:15"],
    weight: "solid",
  },
  {
    title: "Ghost Soldier",
    description:
      "When a foreign corporation moves to seize his neighbors’ land, off-the-grid former Special Forces soldier Henry “Fitz” Fitzgerald wages a one-man war with experimental tech.",
    posterUrl: "https://image.tmdb.org/t/p/w500/8Y4oJ5iUs3hgPcDB3SIEmsNYjZk.jpg",
    genres: ["Action", "Thriller"],
    slots: ["15:30", "18:45", "21:30"],
    weight: "solid",
  },
  {
    title: "Resident Evil",
    description:
      "Medical courier Bryan unwittingly finds himself fighting for survival as one fateful, horrifying night collapses into chaos.",
    posterUrl: "https://image.tmdb.org/t/p/w500/gAgWJhUSQWCgtKR8170nMkYlBda.jpg",
    genres: ["Horror", "Action"],
    slots: ["17:20", "20:00", "22:40"],
    weight: "limited",
  },
  {
    title: "Verity",
    description:
      "Hired to ghostwrite for best-selling author Verity Crawford, Lowen Ashleigh uncovers Verity’s autobiographical notes—and becomes entangled in what may be a lethal conspiracy.",
    posterUrl: "https://image.tmdb.org/t/p/w500/rmaNMA1seHqpjtnYKzyynFAr1g8.jpg",
    genres: ["Thriller", "Drama"],
    slots: ["16:40", "19:30", "22:10"],
    weight: "limited",
  },
  {
    title: "I Play Rocky",
    description:
      "The true story of an unknown actor told “no” at every turn, as Sylvester Stallone bets everything on himself to play the lead in the film he wrote.",
    posterUrl: "https://image.tmdb.org/t/p/w500/xE5tY3lppZUyG7WKKThsuYHuAHr.jpg",
    genres: ["Drama", "History"],
    slots: ["14:20", "17:30", "20:30"],
    weight: "limited",
  },
  {
    title: "Wicker",
    description:
      "Fed up with her small-minded seaside neighbors, a ridiculed fisherwoman commissions a husband made of wicker—sparking outrage, jealousy, and chaos.",
    posterUrl: "https://image.tmdb.org/t/p/w500/6FcBZOKvyrLCKGCyBG0ySCR4okt.jpg",
    genres: ["Fantasy", "Romance", "Comedy"],
    slots: ["15:15", "19:50"],
    weight: "limited",
  },
  {
    title: "Street Fighter",
    description:
      "In 1993, estranged fighters Ryu and Ken Masters are recruited by Chun-Li for the World Warrior Tournament—a brutal clash hiding a deadly conspiracy.",
    posterUrl: "https://image.tmdb.org/t/p/w500/dJPT2Uf12X6aFg8i5N67NTpIZ9t.jpg",
    genres: ["Action", "Adventure"],
    slots: ["18:30", "21:45"],
    weight: "limited",
  },
  {
    title: "Drummer Boy",
    description:
      "As America’s fight for independence begins, a young drummer boy, an enslaved woman, and a divided family search for freedom in a story of faith and forgiveness.",
    posterUrl: "https://image.tmdb.org/t/p/w500/bhjdgMm2fFrysSzVqv5RwRwIbVf.jpg",
    genres: ["Drama", "History", "Music"],
    slots: ["13:45", "18:20"],
    weight: "limited",
  },
  {
    title: "Heart of the Beast",
    description:
      "After a plane crash, Special Forces officer James Belmont and his combat dog Odin are stranded deep in the Alaskan wilderness in a brutal fight for survival.",
    posterUrl: "https://image.tmdb.org/t/p/w500/6sYemVUn79UPKz1ZsSG6kPU4RVy.jpg",
    genres: ["Action", "Adventure", "Drama"],
    slots: ["14:10", "19:20"],
    weight: "limited",
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

    const opens = movie.opensInDays ?? 0;
    for (const dayOffset of daySpan(movie.weight).map((d) => d + opens)) {
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
