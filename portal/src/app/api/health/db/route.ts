import "server-only";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Common database error codes and their meanings
const errorDescriptions: Record<string, string> = {
  ECONNREFUSED: "Database connection refused. Check if the database server is running and accessible.",
  ENOTFOUND: "Database host not found. Check the DATABASE_URL hostname.",
  ETIMEDOUT: "Connection timed out. The database server may be unreachable or behind a firewall.",
  ECONNRESET: "Connection was reset. This may indicate a network issue or server restart.",
  P1000: "Authentication failed. Check the username and password in DATABASE_URL.",
  P1001: "Cannot reach the database server. Check the host and port in DATABASE_URL.",
  P1002: "Database server timed out. The server may be overloaded or unreachable.",
  P1003: "Database does not exist. Check the database name in DATABASE_URL.",
  P1008: "Operations timed out. The database may be under heavy load.",
  P1010: "User was denied access. Check database permissions.",
  P1011: "Error opening a TLS connection. Check SSL configuration.",
  P1012: "Schema engine error. Database may need migrations.",
  P2010: "Raw query failed. Check if database schema is up to date.",
  DEPTH_ZERO_SELF_SIGNED_CERT: "SSL certificate error. Try setting PG_SSL_REJECT_UNAUTHORIZED=false or use sslmode=require.",
  SELF_SIGNED_CERT_IN_CHAIN: "SSL certificate error. The certificate chain contains a self-signed certificate.",
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: "SSL certificate verification failed. Try relaxing SSL settings.",
};

export async function GET() {
  const startTime = Date.now();

  try {
    // Test database connectivity by counting users
    const userCount = await prisma.user.count();
    const duration = Date.now() - startTime;

    // Check if DATABASE_URL is configured (without exposing sensitive data)
    const hasDbUrl = Boolean(process.env.DATABASE_URL);
    let dbHost = "unknown";
    try {
      if (process.env.DATABASE_URL) {
        const url = new URL(process.env.DATABASE_URL);
        dbHost = url.hostname;
      }
    } catch {
      // Ignore URL parsing errors
    }

    return NextResponse.json({
      ok: true,
      status: "connected",
      database: {
        host: dbHost,
        configured: hasDbUrl,
      },
      metrics: {
        responseTimeMs: duration,
        userCount,
      },
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
    }, { status: 200 });
  } catch (error) {
    const duration = Date.now() - startTime;
    const message = error instanceof Error ? error.message : "Database error";
    const maybeCode = typeof error === "object" && error !== null ? (error as { code?: string }).code : undefined;
    const code = typeof maybeCode === "string" ? maybeCode : "UNKNOWN";
    const safeMessage = message.split("\n")[0];

    // Get helpful description for the error
    const description = errorDescriptions[code] || "An unexpected database error occurred.";

    // Log detailed error for server-side debugging
    console.error("DB health check failed:", {
      code,
      message: safeMessage,
      duration,
      env: process.env.VERCEL_ENV || "local",
      hasDbUrl: Boolean(process.env.DATABASE_URL),
    });

    // Check if DATABASE_URL is configured
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({
        ok: false,
        status: "misconfigured",
        code: "MISSING_DATABASE_URL",
        message: "DATABASE_URL environment variable is not set",
        description: "Configure DATABASE_URL in Vercel Environment Variables for all environments (Production, Preview, Development).",
        help: "Go to Vercel Dashboard > Your Project > Settings > Environment Variables",
      }, { status: 503 });
    }

    return NextResponse.json({
      ok: false,
      status: "error",
      code,
      message: safeMessage,
      description,
      metrics: {
        responseTimeMs: duration,
      },
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
    }, { status: 500 });
  }
}
