import "server-only";
import * as fs from "fs";
import { Pool, PoolConfig } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { normalizeDbUrl } from "@/lib/db-url";
import { ensureSupabaseCaCertSync } from "@/lib/ssl-cert";

// CRITICAL: Ensure CA certificate is written and PGSSLROOTCERT is set
// BEFORE any PrismaClient instance is created. This must happen at module
// load time (cold start) so that when Prisma opens the TLS connection,
// the certificate is already available.
const caCertPath = ensureSupabaseCaCertSync();
const envCertPath = process.env.PGSSLROOTCERT;
const resolvedCertPath = caCertPath ?? (envCertPath && fs.existsSync(envCertPath) ? envCertPath : null);

if (!resolvedCertPath && envCertPath) {
  console.warn(`[PRISMA] PGSSLROOTCERT is set to ${envCertPath}, but the file was not found.`);
}

// Read CA certificate once at module initialization for performance.
// The pg module requires the CA cert to be passed directly in the ssl config,
// not via PGSSLROOTCERT environment variable (which is for libpq).
let caCert: string | undefined;
if (resolvedCertPath) {
  try {
    caCert = fs.readFileSync(resolvedCertPath, "utf8");
    console.log(`[PRISMA] Loaded CA certificate from ${resolvedCertPath}`);
  } catch (err) {
    console.warn(`[PRISMA] Failed to read CA certificate from ${resolvedCertPath}:`, err);
  }
}

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
    // Parse sslmode from connection string to correctly map to pg's ssl options.
    // PostgreSQL sslmode semantics:
    //   require     → encrypt, but do NOT verify server certificate
    //   verify-ca   → encrypt + verify cert is signed by trusted CA
    //   verify-full → encrypt + verify cert + verify hostname
    // node-postgres (pg) equivalent:
    //   rejectUnauthorized: false → sslmode=require
    //   rejectUnauthorized: true  → sslmode=verify-ca / verify-full
    let sslmode = "require";
    try {
      const url = new URL(connectionString);
      sslmode = url.searchParams.get("sslmode") || "require";
    } catch {
      // URL parsing failed, keep default
    }

    const envOverride = process.env.PG_SSL_REJECT_UNAUTHORIZED;
    let rejectUnauthorized: boolean;

    if (envOverride !== undefined) {
      // Explicit env override always takes precedence
      rejectUnauthorized = envOverride !== "false";
    } else if (sslmode === "verify-ca" || sslmode === "verify-full") {
      // Verification modes require cert validation
      rejectUnauthorized = true;
    } else {
      // sslmode=require (default for Supabase/Neon/Railway):
      // encrypt the connection but do NOT verify the server certificate.
      // This matches PostgreSQL's sslmode=require semantics exactly.
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
      // Include CA cert if available (enables verification even with require)
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
  pool.on("error", (err: Error) => {
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
