import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { signActivationToken } from "@/lib/license";

interface ActivateLicenseRequest {
  licenseKey: string;
}

export async function POST(req: Request) {
  try {
    const clientIp = getClientIp(req);
    const rateLimitResult = checkRateLimit(
      `license-activate:${clientIp}`,
      RATE_LIMITS.LICENSE_VALIDATE
    );

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Muitas requisições. Tente novamente mais tarde.",
          reason: "RATE_LIMITED",
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

    const body = (await req.json().catch(() => null)) as ActivateLicenseRequest | null;
    const licenseKey = body?.licenseKey?.trim();

    if (!licenseKey) {
      console.warn("License activation failed: missing key", { ip: clientIp });
      return NextResponse.json(
        { ok: false, error: "licenseKey é obrigatório", reason: "MISSING_LICENSE_KEY" },
        { status: 400 }
      );
    }

    const license = await prisma.license.findUnique({
      where: { token: licenseKey },
      include: { client: true },
    });

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null;
    const userAgent = req.headers.get("user-agent") || null;

    if (!license) {
      await prisma.licenseValidationLog.create({
        data: {
          token: licenseKey,
          valid: false,
          reason: "LICENSE_NOT_FOUND",
          ip,
          userAgent,
        },
      });
      console.warn("License activation failed: not found", { ip: clientIp });
      return NextResponse.json(
        { ok: false, reason: "LICENSE_NOT_FOUND", error: "Licença não encontrada" },
        { status: 404 }
      );
    }

    const now = new Date();
    const newerActiveLicense = await prisma.license.findFirst({
      where: {
        clientId: license.clientId,
        createdAt: { gt: license.createdAt },
        expiresAt: { gt: now },
      },
      select: { id: true, token: true, createdAt: true },
    });

    if (newerActiveLicense) {
      await prisma.licenseValidationLog.create({
        data: {
          licenseId: license.id,
          token: licenseKey,
          valid: false,
          reason: "SUPERSEDED",
          ip,
          userAgent,
        },
      });
      return NextResponse.json(
        {
          ok: false,
          reason: "SUPERSEDED",
          error: "Licença substituída por uma nova. Use a licença mais recente gerada para este cliente.",
          clientId: license.clientId,
          newerLicenseCreatedAt: newerActiveLicense.createdAt.toISOString(),
          hint: "Solicite a nova chave de licença ao administrador ou gere uma nova no painel de admin.",
        },
        { status: 409 }
      );
    }

    if (license.expiresAt < now) {
      await prisma.licenseValidationLog.create({
        data: {
          licenseId: license.id,
          token: licenseKey,
          valid: false,
          reason: "EXPIRED",
          ip,
          userAgent,
        },
      });
      console.warn("License activation failed: expired", { licenseId: license.id, ip: clientIp });
      return NextResponse.json(
        {
          ok: false,
          reason: "EXPIRED",
          error: "Licença expirada",
          expiresAt: license.expiresAt.toISOString(),
          clientId: license.clientId,
        },
        { status: 400 }
      );
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("License activation failed: missing JWT_SECRET");
      return NextResponse.json(
        { ok: false, reason: "MISSING_JWT_SECRET", error: "JWT_SECRET não configurado" },
        { status: 500 }
      );
    }

    const payload = {
      licenseId: license.id,
      clientId: license.clientId,
      role: "CLIENT_USER",
      issuedAt: now.toISOString(),
      expiresAt: license.expiresAt.toISOString(),
      jti: randomUUID(),
    };

    const token = signActivationToken(payload, secret);

    await prisma.licenseValidationLog.create({
      data: {
        licenseId: license.id,
        token: licenseKey,
        valid: true,
        reason: "ACTIVATED",
        ip,
        userAgent,
      },
    });

    console.info("License activation success", {
      licenseId: license.id,
      clientId: license.clientId,
      ip: clientIp,
    });

    const response = NextResponse.json({
      ok: true,
      token,
      clientId: license.clientId,
      licenseId: license.id,
      role: payload.role,
      expiresAt: license.expiresAt.toISOString(),
    });

    response.cookies.set("CLICKPRO_JWT", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      expires: license.expiresAt,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("License activation error:", error);
    return NextResponse.json(
      { ok: false, error: "Falha ao ativar licença", reason: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
