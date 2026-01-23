import { PrismaClient, Role } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

function hashPassword(p: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(p, salt, 120000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  const email = process.env.ADMIN_SEED_EMAIL;
  const pass = process.env.ADMIN_SEED_PASSWORD;
  if (!email || !pass) {
    throw new Error(
      "Missing ADMIN_SEED_EMAIL and/or ADMIN_SEED_PASSWORD environment variables.\n" +
      "Please set these before running the seed script:\n" +
      "  export ADMIN_SEED_EMAIL=your-admin@email.com\n" +
      "  export ADMIN_SEED_PASSWORD=YourSecurePassword123"
    );
  }

  await prisma.user.upsert({
    where: { email },
    update: {
      role: Role.SUPER_ADMIN,
      passwordHash: hashPassword(pass),
      name: "Andre (SUPER_ADMIN)"
    },
    create: {
      email,
      role: Role.SUPER_ADMIN,
      passwordHash: hashPassword(pass),
      name: "Andre (SUPER_ADMIN)"
    }
  });

  console.log("Admin created/updated:", email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
