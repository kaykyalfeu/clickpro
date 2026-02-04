import "server-only";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { normalizeDbUrl } from "@/lib/db-url";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient;
  pool: Pool;
};

function createPrismaClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL missing at runtime. Check Vercel Environment Variables (Preview + Production)."
    );
  }

  const normalizedUrl = normalizeDbUrl(process.env.DATABASE_URL);
  if (normalizedUrl && normalizedUrl !== process.env.DATABASE_URL) {
    process.env.DATABASE_URL = normalizedUrl;
  }
  const connectionString = normalizedUrl ?? process.env.DATABASE_URL;

  const pool = globalForPrisma.pool || new Pool({ connectionString });
  const adapter = new PrismaPg(pool);

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.pool = pool;
  }

  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
