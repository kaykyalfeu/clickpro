import "server-only";
import { ensureSslCert } from "@/lib/ssl-cert";

function truthyEnv(value: string | undefined) {
  return value?.toLowerCase() === "true";
}

function falseyEnv(value: string | undefined) {
  return value?.toLowerCase() === "false";
}

/**
 * Normalizes and adjusts database URL for SSL/TLS settings.
 * Supports Supabase, Neon, Railway, and other PostgreSQL providers.
 *
 * Environment variables:
 * - PG_USE_LIBPQ_COMPAT=true: Use libpq compatible parameters (for Supabase pooler)
 * - PG_SSL_REJECT_UNAUTHORIZED=false: Accept self-signed/invalid certificates (emergency fallback)
 * - PG_SSL_MODE=require|verify-ca|verify-full|disable: Override SSL mode
 * - SUPABASE_CA_CERT: SSL certificate content (written to /tmp at runtime)
 */
export function normalizeDbUrl(rawUrl: string | undefined) {
  if (!rawUrl) {
    return rawUrl;
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    // URL parsing failed, return as-is
    return rawUrl;
  }

  const params = url.searchParams;
  const useLibpqCompat = truthyEnv(process.env.PG_USE_LIBPQ_COMPAT);
  const relaxInvalidCerts = falseyEnv(process.env.PG_SSL_REJECT_UNAUTHORIZED);
  const overrideSslMode = process.env.PG_SSL_MODE;

  // Check if this is a Supabase URL (pooler or direct)
  // Using endsWith to prevent subdomain attacks (e.g., evil-supabase.co)
  const isSupabase = url.hostname.endsWith(".supabase.co") || url.hostname.endsWith(".supabase.com");
  // Check if this is a Neon URL
  const isNeon = url.hostname.endsWith(".neon.tech");

  // Handle SSL mode based on provider and configuration
  if (overrideSslMode) {
    // Explicit override takes precedence
    params.set("sslmode", overrideSslMode);
  } else if (useLibpqCompat) {
    // libpq compatibility mode (Supabase pooler)
    params.set("uselibpqcompat", "true");
    params.set("sslmode", "require");
  } else if (relaxInvalidCerts) {
    // Emergency fallback for certificate issues
    params.set("sslaccept", "accept_invalid_certs");
    params.set("sslmode", "require");
  } else if (!params.has("sslmode")) {
    // Default SSL mode based on provider
    if (isSupabase) {
      // Supabase works best with sslmode=require
      params.set("sslmode", "require");
    } else if (isNeon) {
      // Neon requires sslmode=require
      params.set("sslmode", "require");
    } else {
      // Default to require for cloud databases
      params.set("sslmode", "require");
    }
  }

  // Suppress pg-connection-string deprecation warning for non-verify-full modes.
  // pg-connection-string v2.x treats 'require', 'prefer', and 'verify-ca' as
  // aliases for 'verify-full'. Adding uselibpqcompat=true tells it to use
  // standard libpq semantics instead. Our prisma.ts already implements the
  // correct SSL behavior for each mode via explicit pool ssl options.
  const currentSslMode = params.get("sslmode");
  if (
    currentSslMode &&
    ["require", "prefer", "verify-ca"].includes(currentSslMode) &&
    !params.has("uselibpqcompat")
  ) {
    params.set("uselibpqcompat", "true");
  }

  // Handle SSL root certificate path for verify-full/verify-ca modes
  const sslMode = params.get("sslmode");
  if (sslMode === "verify-full" || sslMode === "verify-ca") {
    const existingSslRootCert = params.get("sslrootcert");
    
    // Only resolve cert path if:
    // 1. No sslrootcert is set, OR
    // 2. SUPABASE_CA_CERT env var is set (prefer env var approach)
    const shouldResolveCert = !existingSslRootCert || process.env.SUPABASE_CA_CERT;
    
    if (shouldResolveCert) {
      const certPath = ensureSslCert();
      if (certPath) {
        params.set("sslrootcert", certPath);
        console.log(`[DB-URL] SSL certificate path set to: ${certPath}`);
      } else if (!existingSslRootCert) {
        // Only warn if no cert was specified and we couldn't find one
        console.warn(`[DB-URL] Warning: sslmode=${sslMode} but no certificate found. Connection may fail.`);
      }
    }
  }

  return url.toString();
}
