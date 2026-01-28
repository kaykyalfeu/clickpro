import crypto from "crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, 120000, 32, "sha256")
    .toString("hex");
  return `${salt}:${hash}`;
}

export async function POST(request: Request) {
  try {
    // Rate limiting
    const clientIp = getClientIp(request);
    const rateLimitResult = checkRateLimit(
      `signup:${clientIp}`,
      RATE_LIMITS.SIGNUP
    );

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Muitas tentativas de cadastro. Tente novamente mais tarde.",
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

    const body = await request.json();
    const { firstName, lastName, email, password } = body;

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email e senha são obrigatórios" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "A senha deve ter pelo menos 8 caracteres" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Este email já está cadastrado" },
        { status: 400 }
      );
    }

    // Create the user, client, and membership in a transaction
    const name = [firstName, lastName].filter(Boolean).join(" ") || null;
    const passwordHash = hashPassword(password);

    // Generate a client name and slug from user info
    const clientName = name || email.split("@")[0];
    const baseSlug = clientName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Add timestamp to ensure unique slug
    const clientSlug = `${baseSlug}-${Date.now().toString(36)}`;

    const result = await prisma.$transaction(async (tx) => {
      // Create the client (company)
      const client = await tx.client.create({
        data: {
          name: clientName,
          slug: clientSlug,
        },
      });

      // Create the user
      const user = await tx.user.create({
        data: {
          email,
          name,
          passwordHash,
          role: "CLIENT_ADMIN",
        },
      });

      // Create the membership linking user to client
      await tx.clientMember.create({
        data: {
          userId: user.id,
          clientId: client.id,
          role: "CLIENT_ADMIN",
        },
      });

      return { user, client };
    });

    return NextResponse.json(
      {
        message: "Conta criada com sucesso",
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
        }
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Signup error:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      return NextResponse.json(
        { error: "Banco não inicializado. Execute as migrations do Prisma antes de cadastrar usuários." },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
