import "server-only";
import { prisma } from "./prisma";
import type { LicenseStatus } from "./license";

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
