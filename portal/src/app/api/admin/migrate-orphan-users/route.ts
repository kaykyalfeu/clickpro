import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions, isSuperAdmin } from "@/lib/auth";

// POST /api/admin/migrate-orphan-users - Create clients for users without one
export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || !isSuperAdmin(session)) {
      return NextResponse.json(
        { error: "Acesso negado" },
        { status: 403 }
      );
    }

    // Find all non-SUPER_ADMIN users without any membership
    const orphanUsers = await prisma.user.findMany({
      where: {
        role: { not: "SUPER_ADMIN" },
        memberships: {
          none: {},
        },
      },
    });

    if (orphanUsers.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "Nenhum usuário órfão encontrado",
        migratedCount: 0,
      });
    }

    // Create a client and membership for each orphan user
    const results = await Promise.all(
      orphanUsers.map(async (user) => {
        const clientName = user.name || user.email.split("@")[0];
        const baseSlug = clientName
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");

        const clientSlug = `${baseSlug}-${Date.now().toString(36)}`;

        return prisma.$transaction(async (tx) => {
          const client = await tx.client.create({
            data: {
              name: clientName,
              slug: clientSlug,
            },
          });

          await tx.clientMember.create({
            data: {
              userId: user.id,
              clientId: client.id,
              role: "CLIENT_ADMIN",
            },
          });

          // Update user role to CLIENT_ADMIN if they were CLIENT_USER
          if (user.role === "CLIENT_USER") {
            await tx.user.update({
              where: { id: user.id },
              data: { role: "CLIENT_ADMIN" },
            });
          }

          return { userId: user.id, clientId: client.id, clientName };
        });
      })
    );

    return NextResponse.json({
      ok: true,
      message: `${results.length} usuário(s) migrado(s) com sucesso`,
      migratedCount: results.length,
      migrated: results,
    });
  } catch (error) {
    console.error("Error migrating orphan users:", error);
    return NextResponse.json(
      { error: "Erro ao migrar usuários" },
      { status: 500 }
    );
  }
}
