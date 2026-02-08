import "server-only";
import * as fs from "fs";
import * as path from "path";

/**
 * SSL Certificate Path Resolver for Vercel Serverless Functions
 * 
 * This utility ensures the SSL certificate is available at runtime by:
 * 1. First checking if SUPABASE_CA_CERT environment variable contains the cert content
 * 2. If so, writing it to /tmp/supabase-ca.crt (always writable in serverless)
 * 3. Falling back to file-based paths if the env var is not set
 * 
 * Usage:
 *   const certPath = ensureSslCert();
 *   // Use certPath in your database connection string
 * 
 * Note: In serverless environments, /tmp is isolated per function invocation
 * and ephemeral, so file permissions provide no additional security benefit.
 * 
 * IMPORTANT: For Prisma with SSL verification (sslmode=verify-full), you MUST call
 * ensureSupabaseCaCertSync() BEFORE instantiating PrismaClient. This ensures:
 * 1. The CA cert is written to /tmp/supabase-ca.crt
 * 2. process.env.PGSSLROOTCERT is set to point to that file
 * 3. Prisma/pg can find and use the CA cert for TLS verification
 */

const TMP_CERT_PATH = "/tmp/supabase-ca.crt";

// Possible file paths where the cert might exist (in order of preference)
const CERT_FILE_PATHS = [
  "./certs/supabase-prod-ca.crt",                    // Local development
  path.join(process.cwd(), "certs/supabase-prod-ca.crt"), // Relative to cwd
  "/var/task/certs/supabase-prod-ca.crt",            // Vercel default
  "/var/task/portal/certs/supabase-prod-ca.crt",    // Vercel when root is repo root
];

/**
 * Checks if a file path exists.
 */
function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

/**
 * CRITICAL: Synchronous function to ensure the Supabase CA certificate is available
 * and set PGSSLROOTCERT environment variable BEFORE PrismaClient is instantiated.
 * 
 * This function MUST be called at module load time (not inside an async handler)
 * to guarantee the certificate is available when Prisma opens the TLS connection.
 * 
 * The function:
 * 1. Checks if cert already exists at /tmp/supabase-ca.crt
 * 2. If not, reads SUPABASE_CA_CERT env var and writes the cert to /tmp
 * 3. Sets process.env.PGSSLROOTCERT to the cert path
 * 
 * @returns The path to the certificate if successful, null otherwise
 */
export function ensureSupabaseCaCertSync(): string | null {
  // If cert already exists, just set the env var and return
  if (fileExists(TMP_CERT_PATH)) {
    process.env.PGSSLROOTCERT = TMP_CERT_PATH;
    return TMP_CERT_PATH;
  }

  const raw = process.env.SUPABASE_CA_CERT;
  if (!raw) {
    return resolveExistingCertPath();
  }

  try {
    // Handle certificates stored with literal "\n" (backslash + n) instead of actual newlines.
    // This is common when setting env vars in shells or Vercel dashboard.
    // In JS source: "\\n" is a 2-char string (backslash + n), /\\n/g regex matches it.
    const cert = raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;

    // Write cert with restricted permissions (defense-in-depth)
    fs.writeFileSync(TMP_CERT_PATH, cert, { mode: 0o600 });

    // Set PGSSLROOTCERT for libpq/node-pg to use
    process.env.PGSSLROOTCERT = TMP_CERT_PATH;
    
    return TMP_CERT_PATH;
  } catch (err) {
    console.error(`[SSL] Failed to write certificate synchronously:`, err);
    return resolveExistingCertPath();
  }
}

/**
 * Finds the first existing certificate file path from the list of possible paths.
 * Does not write any files - only checks existing paths.
 */
function findExistingCertPath(): string | null {
  // Check if cert already exists in /tmp (may have been written previously)
  if (fileExists(TMP_CERT_PATH)) {
    return TMP_CERT_PATH;
  }

  // Check file paths (for local dev or when cert is bundled)
  for (const certPath of CERT_FILE_PATHS) {
    if (fileExists(certPath)) {
      return certPath;
    }
  }

  return null;
}

function resolveExistingCertPath(): string | null {
  const existingPath = findExistingCertPath();
  if (existingPath) {
    process.env.PGSSLROOTCERT = existingPath;
    return existingPath;
  }
  return null;
}

/**
 * Ensures the SSL certificate is available and returns its path.
 * 
 * Priority:
 * 1. If SUPABASE_CA_CERT env var is set, writes to /tmp and returns that path
 * 2. If cert already exists in /tmp, returns /tmp path
 * 3. Falls back to checking file paths in CERT_FILE_PATHS order
 * 
 * @returns The path to the SSL certificate, or null if not found/configured
 */
export function ensureSslCert(): string | null {
  // Priority 1: Use SUPABASE_CA_CERT environment variable (most reliable)
  const certContent = process.env.SUPABASE_CA_CERT;
  if (certContent) {
    try {
      const normalizedCert = certContent.includes("\\n") ? certContent.replace(/\\n/g, "\n") : certContent;
      // Write cert content to /tmp (always writable in serverless)
      // Setting mode 0600 for defense-in-depth, though permissions are less
      // relevant in serverless /tmp which is isolated per function invocation
      fs.writeFileSync(TMP_CERT_PATH, normalizedCert, { mode: 0o600 });
      process.env.PGSSLROOTCERT = TMP_CERT_PATH;
      console.log(`[SSL] Certificate written to ${TMP_CERT_PATH} from SUPABASE_CA_CERT env var`);
      return TMP_CERT_PATH;
    } catch (err) {
      console.error(`[SSL] Failed to write cert to ${TMP_CERT_PATH}:`, err);
      // Continue to fallback methods
    }
  }

  // Priority 2 & 3: Check existing file paths
  const existingPath = findExistingCertPath();
  if (existingPath) {
    console.log(`[SSL] Using certificate at ${existingPath}`);
    return existingPath;
  }

  console.log("[SSL] No SSL certificate found. SSL cert path will not be set.");
  return null;
}

/**
 * Gets diagnostic information about SSL certificate availability.
 * Useful for debugging in production environments.
 * 
 * Note: This function does NOT write any files - it only checks what exists.
 * Call ensureSslCert() separately if you need to write the cert from env var.
 */
export function getSslCertDiagnostics(): {
  envVarSet: boolean;
  tmpCertExists: boolean;
  filePaths: Array<{ path: string; exists: boolean }>;
  cwd: string;
  recommendedPath: string | null;
} {
  const envVarSet = !!process.env.SUPABASE_CA_CERT;
  const tmpCertExists = fileExists(TMP_CERT_PATH);
  
  const filePaths = CERT_FILE_PATHS.map((p) => ({
    path: p,
    exists: fileExists(p),
  }));

  // Find the first existing path without side effects
  const recommendedPath = findExistingCertPath();

  return {
    envVarSet,
    tmpCertExists,
    filePaths,
    cwd: process.cwd(),
    recommendedPath,
  };
}
