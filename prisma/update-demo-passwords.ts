import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash("1234", 10);
  const result = await prisma.user.updateMany({
    where: { email: { in: ["user@cinema.local", "admin@cinema.local"] } },
    data: { passwordHash: hash },
  });
  console.log(`Updated ${result.count} demo accounts to password 1234`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
