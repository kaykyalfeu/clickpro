import crypto from "crypto";

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
