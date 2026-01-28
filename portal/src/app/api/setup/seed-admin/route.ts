import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

// POST /api/setup/seed-admin - Create or update super admin user
// This endpoint should be called once after deployment, then disabled
export async function POST(req: Request) {
  try {
    // Get credentials from environment variables
    const email = process.env.ADMIN_SEED_EMAIL;
    const password = process.env.ADMIN_SEED_PASSWORD;
    const setupSecret = process.env.SETUP_SECRET;

    // Verify setup secret from request
    const body = await req.json().catch(() => ({}));
    const { secret } = body;

    if (!setupSecret || secret !== setupSecret) {
      return NextResponse.json(
        { error: "Unauthorized - invalid setup secret" },
        { status: 401 }
      );
    }

    if (!email || !password) {
      return NextResponse.json(
        { error: "Missing ADMIN_SEED_EMAIL or ADMIN_SEED_PASSWORD environment variables" },
        { status: 500 }
      );
    }

    // Check if we should force update (reset password)
    const forceUpdate = body.forceUpdate === true;

    // Check if super admin already exists
    const existingAdmin = await prisma.user.findFirst({
      where: { role: "SUPER_ADMIN" },
    });

    if (existingAdmin && !forceUpdate) {
      return NextResponse.json({
        ok: true,
        message: "Super admin already exists. Use forceUpdate: true to reset password.",
        email: existingAdmin.email,
      });
    }

    // Create or update super admin
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        role: "SUPER_ADMIN",
        passwordHash: hashPassword(password),
        name: "Super Admin",
      },
      create: {
        email,
        role: "SUPER_ADMIN",
        passwordHash: hashPassword(password),
        name: "Super Admin",
      },
    });

    return NextResponse.json({
      ok: true,
      message: existingAdmin ? "Super admin password updated successfully" : "Super admin created successfully",
      email: user.email,
    });
  } catch (error) {
    console.error("Error seeding admin:", error);
    return NextResponse.json(
      { error: "Failed to seed admin user" },
      { status: 500 }
    );
  }
}
