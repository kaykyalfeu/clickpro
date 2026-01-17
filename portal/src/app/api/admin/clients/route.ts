import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions, isSuperAdmin } from "@/lib/auth";

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
        slug: client.slug,
        createdAt: client.createdAt.toISOString(),
        memberCount: client._count.members,
        licenseCount: client._count.licenses,
        hasActiveLicense: client.licenses.length > 0,
        licenseExpiresAt: client.licenses[0]?.expiresAt.toISOString() ?? null,
      })),
    });
  } catch (error) {
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
      },
    });

    return NextResponse.json({
      ok: true,
      client: {
        id: client.id,
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
