import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { authOptions, isSuperAdmin } from "@/lib/auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

// GET /api/admin/clients - List all clients
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || !isSuperAdmin(session)) {
      return NextResponse.json(
        { error: "Acesso negado" },
        { status: 403 }
      );
    }

    // Rate limit by user ID
    const rateLimitResult = checkRateLimit(
      `admin_clients_read:${session.user.id}`,
      RATE_LIMITS.ADMIN_READ
    );
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Muitas requisições. Tente novamente em alguns segundos." },
        { status: 429 }
      );
    }

    const clients = await prisma.client.findMany({
      include: {
        _count: {
          select: {
            members: true,
            licenses: true,
          },
        },
        licenses: {
          where: {
            expiresAt: { gt: new Date() },
          },
          take: 1,
          orderBy: { expiresAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      ok: true,
      clients: clients.map((client) => ({
        id: client.id,
        name: client.name,
        clientId: client.clientId,
        slug: client.slug,
        createdAt: client.createdAt.toISOString(),
        memberCount: client._count.members,
        licenseCount: client._count.licenses,
        hasActiveLicense: client.licenses.length > 0,
        licenseExpiresAt: client.licenses[0]?.expiresAt.toISOString() ?? null,
      })),
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2021") {
        const missingTable = typeof error.meta?.table === "string" ? error.meta.table : "Client";
        return NextResponse.json(
          {
            error: `Tabela ${missingTable} não existe no banco. Rode a migração inicial no Supabase.`,
            requiresMigration: true,
            missingTable,
          },
          { status: 500 }
        );
      }
      if (error.code === "P2022") {
        const missingColumn = typeof error.meta?.column === "string" ? error.meta.column : "clientId";
        return NextResponse.json(
          {
            error: `Banco sem a coluna ${missingColumn} na tabela Client. Rode a migração de clientId no Supabase.`,
            requiresMigration: true,
            missingColumn,
          },
          { status: 500 }
        );
      }
    }
    console.error("Error listing clients:", error);
    return NextResponse.json(
      { error: "Erro ao listar clientes" },
      { status: 500 }
    );
  }
}

// POST /api/admin/clients - Create a new client
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || !isSuperAdmin(session)) {
      return NextResponse.json(
        { error: "Acesso negado" },
        { status: 403 }
      );
    }

    // Rate limit by user ID
    const rateLimitResult = checkRateLimit(
      `admin_clients_write:${session.user.id}`,
      RATE_LIMITS.ADMIN_WRITE
    );
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Muitas requisições. Tente novamente em alguns segundos." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { name, slug } = body;

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json(
        { error: "Nome do cliente é obrigatório (mínimo 2 caracteres)" },
        { status: 400 }
      );
    }

    // Generate slug from name if not provided
    const clientSlug = slug?.trim() || name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Check if slug already exists
    const existingClient = await prisma.client.findUnique({
      where: { slug: clientSlug },
    });

    if (existingClient) {
      return NextResponse.json(
        { error: "Já existe um cliente com este identificador" },
        { status: 400 }
      );
    }

    const client = await prisma.client.create({
      data: {
        name: name.trim(),
        slug: clientSlug,
        clientId: randomUUID(),
      },
    });

    return NextResponse.json({
      ok: true,
      client: {
        id: client.id,
        clientId: client.clientId,
        name: client.name,
        slug: client.slug,
        createdAt: client.createdAt.toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating client:", error);
    return NextResponse.json(
      { error: "Erro ao criar cliente" },
      { status: 500 }
    );
  }
}
