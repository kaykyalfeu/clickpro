import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions, isSuperAdmin } from "@/lib/auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/clients/[id] - Get single client details
export async function GET(req: Request, { params }: RouteParams) {
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
      `admin_client_read:${session.user.id}`,
      RATE_LIMITS.ADMIN_READ
    );
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Muitas requisições. Tente novamente em alguns segundos." },
        { status: 429 }
      );
    }

    const { id } = await params;

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                role: true,
                createdAt: true,
              },
            },
          },
        },
        licenses: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!client) {
      return NextResponse.json(
        { error: "Cliente não encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      client: {
        id: client.id,
        clientId: client.clientId,
        name: client.name,
        slug: client.slug,
        createdAt: client.createdAt.toISOString(),
        members: client.members.map((m) => ({
          id: m.id,
          role: m.role,
          user: {
            id: m.user.id,
            email: m.user.email,
            name: m.user.name,
            role: m.user.role,
            createdAt: m.user.createdAt.toISOString(),
          },
        })),
        licenses: client.licenses.map((l) => ({
          id: l.id,
          token: l.token,
          plan: l.plan,
          expiresAt: l.expiresAt.toISOString(),
          createdAt: l.createdAt.toISOString(),
          isActive: l.expiresAt > new Date(),
        })),
      },
    });
  } catch (error) {
    console.error("Error getting client:", error);
    return NextResponse.json(
      { error: "Erro ao buscar cliente" },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/clients/[id] - Update client
export async function PATCH(req: Request, { params }: RouteParams) {
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
      `admin_client_write:${session.user.id}`,
      RATE_LIMITS.ADMIN_WRITE
    );
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Muitas requisições. Tente novamente em alguns segundos." },
        { status: 429 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const { name, slug } = body;

    const existing = await prisma.client.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Cliente não encontrado" },
        { status: 404 }
      );
    }

    const updateData: { name?: string; slug?: string } = {};

    if (name && typeof name === "string" && name.trim().length >= 2) {
      updateData.name = name.trim();
    }

    if (slug && typeof slug === "string" && slug.trim().length >= 2) {
      // Check if new slug conflicts with another client
      const slugConflict = await prisma.client.findFirst({
        where: {
          slug: slug.trim(),
          id: { not: id },
        },
      });

      if (slugConflict) {
        return NextResponse.json(
          { error: "Este identificador já está em uso" },
          { status: 400 }
        );
      }

      updateData.slug = slug.trim();
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "Nenhum campo válido para atualizar" },
        { status: 400 }
      );
    }

    const client = await prisma.client.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      ok: true,
      client: {
        id: client.id,
        name: client.name,
        slug: client.slug,
        updatedAt: client.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error updating client:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar cliente" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/clients/[id] - Delete client
export async function DELETE(req: Request, { params }: RouteParams) {
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
      `admin_client_write:${session.user.id}`,
      RATE_LIMITS.ADMIN_WRITE
    );
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Muitas requisições. Tente novamente em alguns segundos." },
        { status: 429 }
      );
    }

    const { id } = await params;

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        _count: {
          select: { members: true, licenses: true },
        },
      },
    });

    if (!client) {
      return NextResponse.json(
        { error: "Cliente não encontrado" },
        { status: 404 }
      );
    }

    // Warn if client has members or licenses
    if (client._count.members > 0 || client._count.licenses > 0) {
      return NextResponse.json(
        {
          error: "Cliente possui membros ou licenças. Remova-os primeiro ou use force=true",
          members: client._count.members,
          licenses: client._count.licenses,
        },
        { status: 400 }
      );
    }

    await prisma.client.delete({
      where: { id },
    });

    return NextResponse.json({
      ok: true,
      message: "Cliente removido com sucesso",
    });
  } catch (error) {
    console.error("Error deleting client:", error);
    return NextResponse.json(
      { error: "Erro ao remover cliente" },
      { status: 500 }
    );
  }
}
