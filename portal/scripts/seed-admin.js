const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");

const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function hashPassword(p) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(p, salt, 120000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  const email = process.env.ADMIN_SEED_EMAIL ?? "adrbrag18@gmail.com";
  const pass = process.env.ADMIN_SEED_PASSWORD ?? "Adrbrag18@gmail.com";
  if (!email || !pass) throw new Error("Missing ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Admin already exists:", email);
    return;
  }

  await prisma.user.create({
    data: {
      email,
      role: "SUPER_ADMIN",
      passwordHash: hashPassword(pass),
      name: "Andre (SUPER_ADMIN)"
    }
  });

  console.log("Admin created:", email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
