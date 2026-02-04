import "server-only";
import { Pool, PoolConfig } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { normalizeDbUrl } from "@/lib/db-url";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient;
  pool: Pool;
};

function getPoolConfig(connectionString: string): PoolConfig {
  const config: PoolConfig = {
    connectionString,
    // Connection pool settings optimized for serverless
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };

  // Configure SSL for production environments
  if (process.env.NODE_ENV === "production" || connectionString.includes("supabase")) {
    config.ssl = {
      rejectUnauthorized: process.env.PG_SSL_REJECT_UNAUTHORIZED !== "false",
    };
  }

  return config;
}

function createPrismaClient() {
  const rawUrl = process.env.DATABASE_URL;

  if (!rawUrl) {
    const errorMsg = [
      "DATABASE_URL is not configured.",
      "",
      "For Vercel deployments:",
      "1. Go to your project Settings > Environment Variables",
      "2. Add DATABASE_URL with your PostgreSQL connection string",
      "3. Make sure it's set for Production, Preview, AND Development environments",
      "4. Redeploy your application",
      "",
      "Example format:",
      "postgresql://user:password@host:5432/database?sslmode=require",
    ].join("\n");

    console.error("[PRISMA] " + errorMsg.replace(/\n/g, "\n[PRISMA] "));
    throw new Error("DATABASE_URL missing at runtime. Check Vercel Environment Variables (Preview + Production).");
  }

  const normalizedUrl = normalizeDbUrl(rawUrl);
  const connectionString = normalizedUrl ?? rawUrl;

  // Log connection info for debugging (without credentials)
  try {
    const urlObj = new URL(connectionString);
    console.log(`[PRISMA] Connecting to ${urlObj.hostname}:${urlObj.port || 5432}${urlObj.pathname}`);
    console.log(`[PRISMA] SSL mode: ${urlObj.searchParams.get("sslmode") || "default"}`);
  } catch {
    console.log("[PRISMA] Connecting with provided connection string");
  }

  const poolConfig = getPoolConfig(connectionString);
  const pool = globalForPrisma.pool || new Pool(poolConfig);

  // Handle pool errors gracefully
  pool.on("error", (err) => {
    console.error("[PRISMA] Pool error:", err.message);
  });

  const adapter = new PrismaPg(pool);

  // Cache pool in development to avoid connection leaks
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.pool = pool;
  }

  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
