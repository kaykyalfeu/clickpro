import "server-only";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient;
  pool: Pool;
};

function resolveDatabaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    ""
  );
}

function createPrismaClient() {
  const connectionString = resolveDatabaseUrl();
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL não está configurada. Defina DATABASE_URL (ou POSTGRES_PRISMA_URL/POSTGRES_URL) no ambiente."
    );
  }
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
