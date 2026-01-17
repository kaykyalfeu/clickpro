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

// GET /api/admin/users - List all users
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

    const users = await prisma.user.findMany({
      where: clientId
        ? {
            memberships: {
              some: { clientId },
            },
          }
        : undefined,
      include: {
        memberships: {
          include: {
            client: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      ok: true,
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        clients: user.memberships.map((m) => ({
          id: m.client.id,
          name: m.client.name,
          slug: m.client.slug,
          memberRole: m.role,
        })),
      })),
    });
  } catch (error) {
    console.error("Error listing users:", error);
    return NextResponse.json(
      { error: "Erro ao listar usuários" },
      { status: 500 }
    );
  }
}

// POST /api/admin/users - Create a new user
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
    const { email, name, role, clientId, password, generatePassword } = body;

    // Validation
    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email é obrigatório" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Email inválido" },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Este email já está cadastrado" },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles: Role[] = ["SUPER_ADMIN", "CLIENT_ADMIN", "CLIENT_USER"];
    const userRole: Role = validRoles.includes(role) ? role : "CLIENT_USER";

    // Non-SUPER_ADMIN users must have a client
    if (userRole !== "SUPER_ADMIN" && !clientId) {
      return NextResponse.json(
        { error: "Usuários CLIENT_ADMIN e CLIENT_USER precisam de um cliente" },
        { status: 400 }
      );
    }

    // Verify client exists if provided
    if (clientId) {
      const client = await prisma.client.findUnique({
        where: { id: clientId },
      });

      if (!client) {
        return NextResponse.json(
          { error: "Cliente não encontrado" },
          { status: 404 }
        );
      }
    }

    // Generate or use provided password
    let userPassword = password;
    let passwordGenerated = false;

    if (!password || generatePassword) {
      userPassword = generateRandomPassword();
      passwordGenerated = true;
    }

    if (userPassword.length < 8) {
      return NextResponse.json(
        { error: "Senha deve ter pelo menos 8 caracteres" },
        { status: 400 }
      );
    }

    // Create user and membership in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: email.toLowerCase().trim(),
          name: name?.trim() || null,
          passwordHash: hashPassword(userPassword),
          role: userRole,
        },
      });

      // Create membership if clientId provided
      if (clientId && userRole !== "SUPER_ADMIN") {
        await tx.clientMember.create({
          data: {
            userId: user.id,
            clientId,
            role: userRole,
          },
        });
      }

      return user;
    });

    const response: {
      ok: boolean;
      user: {
        id: string;
        email: string;
        name: string | null;
        role: Role;
        clientId?: string;
      };
      temporaryPassword?: string;
    } = {
      ok: true,
      user: {
        id: result.id,
        email: result.email,
        name: result.name,
        role: result.role,
      },
    };

    if (clientId) {
      response.user.clientId = clientId;
    }

    // Return temporary password if generated
    if (passwordGenerated) {
      response.temporaryPassword = userPassword;
    }

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Erro ao criar usuário" },
      { status: 500 }
    );
  }
}
