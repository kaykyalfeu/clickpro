import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/debug/check-user?email=xxx
 *
 * Debug endpoint to check if a user exists in the database.
 * This helps diagnose login issues.
 *
 * IMPORTANT: Remove this endpoint in production after debugging.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json({ error: "Email parameter required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check for exact match (normalized)
    const userExact = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        passwordHash: true,
      },
    });

    // Also check for any similar emails (case variations)
    const userSimilar = await prisma.user.findMany({
      where: {
        email: {
          contains: email.split("@")[0],
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      take: 5,
    });

    // Count total users
    const totalUsers = await prisma.user.count();

    // List all users (for debugging small databases)
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      take: 20,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      query: {
        original: email,
        normalized: normalizedEmail,
      },
      exactMatch: userExact
        ? {
            found: true,
            id: userExact.id,
            email: userExact.email,
            name: userExact.name,
            role: userExact.role,
            createdAt: userExact.createdAt,
            hasPasswordHash: !!userExact.passwordHash,
            passwordHashFormat: userExact.passwordHash
              ? userExact.passwordHash.includes(":")
                ? "valid (salt:hash)"
                : "invalid format"
              : "missing",
          }
        : { found: false },
      similarEmails: userSimilar,
      database: {
        totalUsers,
        recentUsers: allUsers,
      },
    });
  } catch (error) {
    console.error("Debug check-user error:", error);
    return NextResponse.json(
      {
        error: "Database error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
