import crypto from "crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions, isSuperAdmin } from "@/lib/auth";

function generateLicenseKey(): string {
  const segments: string[] = [];
  for (let i = 0; i < 4; i++) {
    const segment = crypto.randomBytes(2).toString("hex").toUpperCase();
    segments.push(segment);
  }
  return segments.join("-");
}

// GET /api/admin/licenses - List all licenses
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || !isSuperAdmin(session)) {
      return NextResponse.json(
        { error: "Acesso negado" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");
    const status = searchParams.get("status"); // active, expired, all

    const now = new Date();
    const whereClause: {
      clientId?: string;
      expiresAt?: { gt?: Date; lte?: Date };
    } = {};

    if (clientId) {
      whereClause.clientId = clientId;
    }

    if (status === "active") {
      whereClause.expiresAt = { gt: now };
    } else if (status === "expired") {
      whereClause.expiresAt = { lte: now };
    }

    const licenses = await prisma.license.findMany({
      where: whereClause,
      include: {
        client: {
          select: { id: true, name: true, slug: true },
        },
        _count: {
          select: { logs: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      ok: true,
      licenses: licenses.map((license) => ({
        id: license.id,
        token: license.token,
        plan: license.plan,
        expiresAt: license.expiresAt.toISOString(),
        createdAt: license.createdAt.toISOString(),
        isActive: license.expiresAt > now,
        client: {
          id: license.client.id,
          name: license.client.name,
          slug: license.client.slug,
        },
        validationCount: license._count.logs,
        features: license.features,
        limits: license.limits,
      })),
    });
  } catch (error) {
    console.error("Error listing licenses:", error);
    return NextResponse.json(
      { error: "Erro ao listar licencas" },
      { status: 500 }
    );
  }
}

// POST /api/admin/licenses - Create a new license
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || !isSuperAdmin(session)) {
      return NextResponse.json(
        { error: "Acesso negado" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { clientId, plan, expiresInDays, features, limits } = body;

    if (!clientId) {
      return NextResponse.json(
        { error: "clientId e obrigatorio" },
        { status: 400 }
      );
    }

    if (!expiresInDays || expiresInDays < 1 || expiresInDays > 3650) {
      return NextResponse.json(
        { error: "expiresInDays deve estar entre 1 e 3650" },
        { status: 400 }
      );
    }

    // Verify client exists
    const client = await prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      return NextResponse.json(
        { error: "Cliente nao encontrado" },
        { status: 404 }
      );
    }

    const licenseKey = generateLicenseKey();
    const expiresAt = new Date(
      Date.now() + expiresInDays * 24 * 60 * 60 * 1000
    );

    const license = await prisma.license.create({
      data: {
        token: licenseKey,
        clientId,
        plan: plan || "standard",
        expiresAt,
        features: features || {},
        limits: limits || {},
      },
      include: {
        client: true,
      },
    });

    return NextResponse.json({
      ok: true,
      license: {
        id: license.id,
        token: license.token,
        plan: license.plan,
        expiresAt: license.expiresAt.toISOString(),
        createdAt: license.createdAt.toISOString(),
        client: {
          id: license.client.id,
          name: license.client.name,
        },
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating license:", error);
    return NextResponse.json(
      { error: "Erro ao criar licenca" },
      { status: 500 }
    );
  }
}
