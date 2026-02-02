import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * Verify password using timing-safe comparison
 * Uses PBKDF2 with SHA-256, 120000 iterations, 32-byte key
 */
function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, hash] = storedHash.split(":");
    if (!salt || !hash) return false;

    const computed = crypto
      .pbkdf2Sync(password, salt, 120000, 32, "sha256")
      .toString("hex");

    const hashBuffer = Buffer.from(hash, "hex");
    const computedBuffer = Buffer.from(computed, "hex");

    // Prevent crash if buffer sizes don't match
    if (hashBuffer.length !== computedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(hashBuffer, computedBuffer);
  } catch {
    return false;
  }
}

/**
 * POST /api/auth/login
 *
 * Pre-validates credentials and returns detailed error messages.
 * This endpoint is meant to be called BEFORE signIn() to provide
 * user-friendly error messages.
 *
 * Note: This does NOT create a session. After successful validation,
 * the client should call NextAuth's signIn() to establish the session.
 */
export async function POST(request: Request) {
  try {
    // Rate limiting
    const clientIp = getClientIp(request);
    const rateLimitResult = checkRateLimit(
      `login:${clientIp}`,
      RATE_LIMITS.LOGIN
    );

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Muitas tentativas de login. Tente novamente em alguns minutos.",
          code: "RATE_LIMITED",
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

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: "Dados de requisição inválidos",
          code: "INVALID_REQUEST",
        },
        { status: 400 }
      );
    }

    const { email, password } = body;

    // Validate required fields
    if (!email || typeof email !== "string") {
      return NextResponse.json(
        {
          ok: false,
          error: "Email é obrigatório",
          code: "MISSING_EMAIL",
        },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        {
          ok: false,
          error: "Senha é obrigatória",
          code: "MISSING_PASSWORD",
        },
        { status: 400 }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        memberships: {
          include: { client: true },
          take: 1,
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          error: "Usuário não encontrado",
          code: "USER_NOT_FOUND",
        },
        { status: 401 }
      );
    }

    // Verify password
    const isValid = verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        {
          ok: false,
          error: "Senha incorreta",
          code: "INVALID_PASSWORD",
        },
        { status: 401 }
      );
    }

    // Get client info for non-super-admin users
    const membership = user.role === "SUPER_ADMIN" ? null : user.memberships?.[0];

    // Return success with user info (no sensitive data)
    return NextResponse.json({
      ok: true,
      message: "Credenciais válidas",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        clientId: membership?.clientId ?? null,
        clientName: membership?.client?.name ?? null,
      },
    });
  } catch (error) {
    console.error("Login validation error:", error);

    // Check for Prisma database connection errors
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error.code === "P1000" || error.code === "P1001" || error.code === "P1002" || error.code === "P1003")
    ) {
      console.error("Database connection error during login. Check DATABASE_URL configuration.");
      return NextResponse.json(
        {
          ok: false,
          error: "Erro de conexão com o banco de dados. Entre em contato com o suporte.",
          code: "DATABASE_CONNECTION_ERROR",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: "Erro no servidor durante autenticação",
        code: "SERVER_ERROR",
      },
      { status: 500 }
    );
  }
}

// Only POST method is allowed
export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      error: "Método não permitido. Use POST.",
      code: "METHOD_NOT_ALLOWED",
    },
    { status: 405 }
  );
}
