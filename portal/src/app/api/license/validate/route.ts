import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";

async function getPrisma() {
  const { getPrismaClient } = await import("@/lib/prisma");
  return getPrismaClient();
}

interface ValidateLicenseRequest {
  licenseKey: string;
}

export async function POST(req: Request) {
  try {
    // Rate limiting
    const clientIp = getClientIp(req);
    const rateLimitResult = checkRateLimit(
      `license-validate:${clientIp}`,
      RATE_LIMITS.LICENSE_VALIDATE
    );

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Muitas requisições. Tente novamente mais tarde.",
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
            ),
          },
        }
      );
    }

    const body = (await req.json()) as ValidateLicenseRequest;

    if (!body.licenseKey || typeof body.licenseKey !== "string") {
      return NextResponse.json(
        { ok: false, error: "licenseKey é obrigatório" },
        { status: 400 }
      );
    }

    const licenseKey = body.licenseKey.trim();

    if (!licenseKey) {
      return NextResponse.json(
        { ok: false, error: "licenseKey não pode estar vazio" },
        { status: 400 }
      );
    }

    // Lookup license in database
    const license = await (await getPrisma()).license.findUnique({
      where: { token: licenseKey },
      include: { client: true },
    });

    // Log validation attempt
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null;
    const userAgent = req.headers.get("user-agent") || null;

    if (!license) {
      await (await getPrisma()).licenseValidationLog.create({
        data: {
          token: licenseKey,
          valid: false,
          reason: "LICENSE_NOT_FOUND",
          ip,
          userAgent,
        },
      });

      return NextResponse.json({
        ok: true,
        valid: false,
        reason: "LICENSE_NOT_FOUND",
      });
    }

    const now = new Date();
    if (license.expiresAt < now) {
      await (await getPrisma()).licenseValidationLog.create({
        data: {
          licenseId: license.id,
          token: licenseKey,
          valid: false,
          reason: "EXPIRED",
          ip,
          userAgent,
        },
      });

      return NextResponse.json({
        ok: true,
        valid: false,
        reason: "EXPIRED",
        expiresAt: license.expiresAt.toISOString(),
        clientId: license.clientId,
        clientName: license.client?.name ?? null,
      });
    }

    // Valid license
    await (await getPrisma()).licenseValidationLog.create({
      data: {
        licenseId: license.id,
        token: licenseKey,
        valid: true,
        ip,
        userAgent,
      },
    });

    return NextResponse.json({
      ok: true,
      valid: true,
      expiresAt: license.expiresAt.toISOString(),
      clientId: license.clientId,
      clientName: license.client?.name ?? null,
      plan: license.plan,
      features: license.features,
      limits: license.limits,
    });
  } catch (error) {
    console.error("License validation error:", error);
    return NextResponse.json(
      { ok: false, error: "Falha ao validar licença" },
      { status: 500 }
    );
  }
}
