import crypto from "crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions, isSuperAdmin } from "@/lib/auth";
import type { Role } from "@prisma/client";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, 120000, 32, "sha256")
    .toString("hex");
  return `${salt}:${hash}`;
}

function generateRandomPassword(): string {
  return crypto.randomBytes(12).toString("base64").slice(0, 16);
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/users/[id] - Get single user details
export async function GET(req: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || !isSuperAdmin(session)) {
      return NextResponse.json(
        { error: "Acesso negado" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        memberships: {
          include: {
            client: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Usuário não encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        clients: user.memberships.map((m) => ({
          id: m.client.id,
          name: m.client.name,
          slug: m.client.slug,
          memberRole: m.role,
          membershipId: m.id,
        })),
      },
    });
  } catch (error) {
    console.error("Error getting user:", error);
    return NextResponse.json(
      { error: "Erro ao buscar usuário" },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/users/[id] - Update user
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || !isSuperAdmin(session)) {
      return NextResponse.json(
        { error: "Acesso negado" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const { name, role, resetPassword, newPassword, addToClient, removeFromClient } = body;

    const existing = await prisma.user.findUnique({
      where: { id },
      include: {
        memberships: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Usuário não encontrado" },
        { status: 404 }
      );
    }

    // Prevent modifying own admin account in certain ways
    if (id === session.user.id) {
      if (role && role !== "SUPER_ADMIN") {
        return NextResponse.json(
          { error: "Você não pode remover seus próprios privilégios de admin" },
          { status: 400 }
        );
      }
    }

    const updateData: { name?: string; role?: Role; passwordHash?: string } = {};
    let generatedPassword: string | null = null;

    if (name !== undefined) {
      updateData.name = name?.trim() || null;
    }

    if (role) {
      const validRoles: Role[] = ["SUPER_ADMIN", "CLIENT_ADMIN", "CLIENT_USER"];
      if (validRoles.includes(role)) {
        updateData.role = role;
      }
    }

    // Handle password reset
    if (resetPassword) {
      generatedPassword = generateRandomPassword();
      updateData.passwordHash = hashPassword(generatedPassword);
    } else if (newPassword && newPassword.length >= 8) {
      updateData.passwordHash = hashPassword(newPassword);
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    // Handle client membership changes
    if (addToClient) {
      const client = await prisma.client.findUnique({
        where: { id: addToClient },
      });

      if (client) {
        // Check if membership already exists
        const existingMembership = await prisma.clientMember.findUnique({
          where: {
            userId_clientId: {
              userId: id,
              clientId: addToClient,
            },
          },
        });

        if (!existingMembership) {
          await prisma.clientMember.create({
            data: {
              userId: id,
              clientId: addToClient,
              role: updatedUser.role === "SUPER_ADMIN" ? "CLIENT_ADMIN" : updatedUser.role,
            },
          });
        }
      }
    }

    if (removeFromClient) {
      await prisma.clientMember.deleteMany({
        where: {
          userId: id,
          clientId: removeFromClient,
        },
      });
    }

    const response: {
      ok: boolean;
      user: {
        id: string;
        email: string;
        name: string | null;
        role: Role;
      };
      temporaryPassword?: string;
    } = {
      ok: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
      },
    };

    if (generatedPassword) {
      response.temporaryPassword = generatedPassword;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar usuário" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/users/[id] - Delete user
export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || !isSuperAdmin(session)) {
      return NextResponse.json(
        { error: "Acesso negado" },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Prevent self-deletion
    if (id === session.user.id) {
      return NextResponse.json(
        { error: "Você não pode excluir sua própria conta" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Usuário não encontrado" },
        { status: 404 }
      );
    }

    // Delete memberships first, then user
    await prisma.$transaction([
      prisma.clientMember.deleteMany({
        where: { userId: id },
      }),
      prisma.user.delete({
        where: { id },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      message: "Usuário removido com sucesso",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Erro ao remover usuário" },
      { status: 500 }
    );
  }
}
