import { NextResponse } from "next/server";
import { getSslCertDiagnostics, ensureSslCert } from "@/lib/ssl-cert";

/**
 * Debug endpoint to diagnose SSL certificate path issues on Vercel
 * 
 * GET /api/debug/ssl
 * 
 * Returns information about:
 * - Current working directory
 * - Whether SUPABASE_CA_CERT env var is set
 * - Which certificate file paths exist
 * - The recommended certificate path
 * 
 * Security: This endpoint is disabled in production by default.
 * Set ALLOW_SSL_DEBUG=true in environment variables to enable temporarily.
 * IMPORTANT: Remove or disable this endpoint after debugging is complete.
 */
export async function GET() {
  // Only allow in non-production or with explicit debug flag
  const allowDebug = process.env.NODE_ENV !== "production" || 
                     process.env.ALLOW_SSL_DEBUG === "true";
  
  if (!allowDebug) {
    return NextResponse.json(
      { error: "Debug endpoint disabled in production. Set ALLOW_SSL_DEBUG=true to enable temporarily." },
      { status: 403 }
    );
  }

  try {
    const diagnostics = getSslCertDiagnostics();
    
    // Actually ensure the cert exists (with side effects) to show the active path
    const activePath = ensureSslCert();
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      nodeEnv: process.env.NODE_ENV,
      diagnostics: {
        cwd: diagnostics.cwd,
        envVarSet: diagnostics.envVarSet,
        // Only show envVarLength in development to avoid leaking info about cert format
        ...(process.env.NODE_ENV !== "production" && {
          envVarLength: process.env.SUPABASE_CA_CERT?.length ?? 0,
        }),
        tmpCertExists: diagnostics.tmpCertExists,
        activePath,
        recommendedPath: diagnostics.recommendedPath,
        filePaths: diagnostics.filePaths,
        // Show PGSSLROOTCERT to verify it's set correctly
        pgsslrootcert: process.env.PGSSLROOTCERT ?? null,
      },
      recommendation: activePath 
        ? `Certificate active at: ${activePath}`
        : "No certificate found. Set SUPABASE_CA_CERT env var with the certificate content.",
      // Additional verification for SSL setup
      sslSetupValid: !!(activePath && process.env.PGSSLROOTCERT === activePath),
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}
