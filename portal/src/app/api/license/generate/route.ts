import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { authOptions, isSuperAdmin, isAtLeastClientAdmin, getSessionClientId } from "@/lib/auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import type { Prisma } from "@prisma/client";

interface GenerateLicenseRequest {
  clientId?: string;
  plan?: string;
  expiresInDays: number;
  features?: Prisma.InputJsonValue;
  limits?: Prisma.InputJsonValue;
}

function generateLicenseKey(): string {
  const segments: string[] = [];
  for (let i = 0; i < 4; i++) {
    const segment = crypto.randomBytes(2).toString("hex").toUpperCase();
    segments.push(segment);
  }
  return segments.join("-");
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { ok: false, error: "Não autorizado" },
        { status: 401 }
      );
    }

    // Only SUPER_ADMIN and CLIENT_ADMIN can generate licenses
    if (!isAtLeastClientAdmin(session)) {
      return NextResponse.json(
        { ok: false, error: "Permissão negada. Apenas administradores podem gerar licenças." },
        { status: 403 }
      );
    }

    // Rate limiting per user
    const rateLimitResult = checkRateLimit(
      `license-generate:${session.user.id}`,
      RATE_LIMITS.LICENSE_GENERATE
    );

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Limite de geração de licenças atingido. Tente novamente mais tarde.",
        },
        { status: 429 }
      );
    }

    const body = (await req.json()) as GenerateLicenseRequest;

    if (
      !body.expiresInDays ||
      body.expiresInDays < 1 ||
      body.expiresInDays > 3650
    ) {
      return NextResponse.json(
        { ok: false, error: "expiresInDays deve estar entre 1 e 3650" },
        { status: 400 }
      );
    }

    // Determine clientId based on role
    let targetClientId: string | null;

    if (isSuperAdmin(session)) {
      // SUPER_ADMIN can specify any clientId
      targetClientId = body.clientId || null;
    } else {
      // CLIENT_ADMIN/CLIENT_USER use their own clientId (ignore body.clientId)
      targetClientId = getSessionClientId(session);
    }

    if (!targetClientId) {
      return NextResponse.json(
        { ok: false, error: "clientId é obrigatório" },
        { status: 400 }
      );
    }

    // Verify client exists
    const client = await prisma.client.findUnique({
      where: { id: targetClientId },
    });

    if (!client) {
      return NextResponse.json(
        { ok: false, error: "Cliente não encontrado" },
        { status: 404 }
      );
    }

    const licenseKey = generateLicenseKey();
    const expiresAt = new Date(
      Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000
    );

    const license = await prisma.license.create({
      data: {
        token: licenseKey,
        clientId: targetClientId,
        plan: body.plan || "standard",
        expiresAt,
        features: body.features ?? {},
        limits: body.limits ?? {},
      },
    });

    return NextResponse.json({
      ok: true,
      licenseKey: license.token,
      clientId: license.clientId,
      clientName: client.name,
      plan: license.plan,
      issuedAt: license.createdAt.toISOString(),
      expiresAt: license.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("License generation error:", error);
    return NextResponse.json(
      { ok: false, error: "Falha ao gerar licença" },
      { status: 500 }
    );
  }
}
