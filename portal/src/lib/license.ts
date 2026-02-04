import crypto from "crypto";
import { prisma } from "./prisma";

// ============================================
// License Status Check (DB-based)
// ============================================

export interface LicenseStatus {
  hasLicense: boolean;
  isValid: boolean;
  plan: string | null;
  expiresAt: Date | null;
  daysRemaining: number;
  features: Record<string, unknown>;
  limits: Record<string, unknown>;
}

/**
 * Check if a client has a valid license
 * Returns license status with details
 */
export async function checkClientLicense(
  clientId: string | null
): Promise<LicenseStatus> {
  const noLicense: LicenseStatus = {
    hasLicense: false,
    isValid: false,
    plan: null,
    expiresAt: null,
    daysRemaining: 0,
    features: {},
    limits: {},
  };

  if (!clientId) {
    return noLicense;
  }

  const now = new Date();

  // Find the most recent active license for this client
  const license = await prisma.license.findFirst({
    where: {
      clientId,
      expiresAt: { gt: now },
    },
    orderBy: { expiresAt: "desc" },
  });

  if (!license) {
    // Check if they have any license (expired)
    const expiredLicense = await prisma.license.findFirst({
      where: { clientId },
      orderBy: { expiresAt: "desc" },
    });

    if (expiredLicense) {
      return {
        hasLicense: true,
        isValid: false,
        plan: expiredLicense.plan,
        expiresAt: expiredLicense.expiresAt,
        daysRemaining: 0,
        features: expiredLicense.features as Record<string, unknown>,
        limits: expiredLicense.limits as Record<string, unknown>,
      };
    }

    return noLicense;
  }

  const msRemaining = license.expiresAt.getTime() - now.getTime();
  const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

  return {
    hasLicense: true,
    isValid: true,
    plan: license.plan,
    expiresAt: license.expiresAt,
    daysRemaining,
    features: license.features as Record<string, unknown>,
    limits: license.limits as Record<string, unknown>,
  };
}

/**
 * Format license status for API response
 */
export function formatLicenseForResponse(license: LicenseStatus) {
  return {
    hasLicense: license.hasLicense,
    isValid: license.isValid,
    plan: license.plan,
    expiresAt: license.expiresAt?.toISOString() ?? null,
    daysRemaining: license.daysRemaining,
  };
}

// ============================================
// License JWT Signing/Verification
// ============================================

export type LicensePayload = {
  licenseId: string;
  clientId: string;
  plan: string;
  issuedAt: string;
  expiresAt: string;
  features: Record<string, any>;
  limits: Record<string, any>;
  jti: string;
};

function base64url(input: Buffer | string) {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return b.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function signLicense(payload: LicensePayload, secret: string) {
  const header = { alg: "HS256", typ: "JWT" };
  const h = base64url(JSON.stringify(header));
  const p = base64url(JSON.stringify(payload));
  const data = `${h}.${p}`;
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64");
  const s = sig.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${data}.${s}`;
}

export type ActivationPayload = {
  licenseId: string;
  clientId: string;
  role: string;
  issuedAt: string;
  expiresAt: string;
  jti: string;
};

export function signActivationToken(payload: ActivationPayload, secret: string) {
  const header = { alg: "HS256", typ: "JWT" };
  const h = base64url(JSON.stringify(header));
  const p = base64url(JSON.stringify(payload));
  const data = `${h}.${p}`;
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64");
  const s = sig.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${data}.${s}`;
}

export type VerifyLicenseResult =
  | { ok: false; reason: "INVALID_FORMAT" | "BAD_SIGNATURE" | "BAD_EXPIRES" | "EXPIRED" }
  | { ok: true; payload: LicensePayload };

export function verifyLicense(token: string, secret: string): VerifyLicenseResult {
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "INVALID_FORMAT" as const };

  const [h, p, s] = parts;
  const data = `${h}.${p}`;
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64")
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  if (sig !== s) return { ok: false, reason: "BAD_SIGNATURE" as const };

  const payload = JSON.parse(Buffer.from(p.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")) as LicensePayload;
  const now = Date.now();
  const exp = Date.parse(payload.expiresAt);
  if (Number.isNaN(exp)) return { ok: false, reason: "BAD_EXPIRES" as const };
  if (now > exp) return { ok: false, reason: "EXPIRED" as const };

  return { ok: true as const, payload };
}

// ============================================
// License Activation Error Formatting
// ============================================

export interface ActivationErrorResponse {
  ok: false;
  error?: string;
  reason?: string;
  hint?: string;
}

/**
 * Format activation error message from API response.
 * Includes hint if available for better user guidance.
 */
export function formatActivationError(data: ActivationErrorResponse): string {
  const baseError = data.error || data.reason || "Falha ao ativar licença.";
  if (data.hint) {
    return `${baseError} — ${data.hint}`;
  }
  return baseError;
}
