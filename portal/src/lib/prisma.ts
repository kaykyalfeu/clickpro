import "server-only";
import * as fs from "fs";
import { Pool, PoolConfig } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { normalizeDbUrl } from "@/lib/db-url";
import { ensureSupabaseCaCertSync } from "@/lib/ssl-cert";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
  caCert: string | undefined;
};

function loadCaCert() {
  if (globalForPrisma.caCert !== undefined) {
    return globalForPrisma.caCert;
  }
  const caCertPath = ensureSupabaseCaCertSync();
  const envCertPath = process.env.PGSSLROOTCERT;
  const resolvedCertPath = caCertPath ?? (envCertPath && fs.existsSync(envCertPath) ? envCertPath : null);

  if (!resolvedCertPath && envCertPath) {
    console.warn(`[PRISMA] PGSSLROOTCERT is set to ${envCertPath}, but the file was not found.`);
  }

  if (resolvedCertPath) {
    try {
      globalForPrisma.caCert = fs.readFileSync(resolvedCertPath, "utf8");
      console.log(`[PRISMA] Loaded CA certificate from ${resolvedCertPath}`);
      return globalForPrisma.caCert;
    } catch (err) {
      console.warn(`[PRISMA] Failed to read CA certificate from ${resolvedCertPath}:`, err);
    }
  }

  globalForPrisma.caCert = undefined;
  return undefined;
}

function getPoolConfig(connectionString: string, caCert?: string): PoolConfig {
  const config: PoolConfig = {
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };

  if (process.env.NODE_ENV === "production" || connectionString.includes("supabase")) {
    let sslmode = "require";
    try {
      const url = new URL(connectionString);
      sslmode = url.searchParams.get("sslmode") || "require";
    } catch {
      // keep default
    }

    const envOverride = process.env.PG_SSL_REJECT_UNAUTHORIZED;
    let rejectUnauthorized: boolean;

    if (envOverride !== undefined) {
      rejectUnauthorized = envOverride !== "false";
    } else if (sslmode === "verify-ca" || sslmode === "verify-full") {
      rejectUnauthorized = true;
    } else {
      rejectUnauthorized = false;
    }

    if (rejectUnauthorized && !caCert) {
      console.warn(
        `[PRISMA] sslmode=${sslmode} requires a CA certificate, but none was loaded. Falling back to sslmode=require behavior.`,
      );
      rejectUnauthorized = false;
    }

    config.ssl = {
      rejectUnauthorized,
      ...(caCert && { ca: caCert }),
    };

    console.log(`[PRISMA] SSL config: sslmode=${sslmode}, rejectUnauthorized=${rejectUnauthorized}, caCert=${caCert ? "loaded" : "none"}`);
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
  const caCert = loadCaCert();

  try {
    const urlObj = new URL(connectionString);
    console.log(`[PRISMA] Connecting to ${urlObj.hostname}:${urlObj.port || 5432}${urlObj.pathname}`);
    console.log(`[PRISMA] SSL mode: ${urlObj.searchParams.get("sslmode") || "default"}`);
  } catch {
    console.log("[PRISMA] Connecting with provided connection string");
  }

  const poolConfig = getPoolConfig(connectionString, caCert);
  const pool = globalForPrisma.pool || new Pool(poolConfig);

  pool.on("error", (err: Error) => {
    console.error("[PRISMA] Pool error:", err.message);
  });

  const adapter = new PrismaPg(pool);

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.pool = pool;
  }

  return new PrismaClient({ adapter });
}

export function getPrismaClient() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}
