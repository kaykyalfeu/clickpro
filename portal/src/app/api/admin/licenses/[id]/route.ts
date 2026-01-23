import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions, isSuperAdmin } from "@/lib/auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/licenses/[id] - Get license details with validation logs
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
      `admin_license_read:${session.user.id}`,
      RATE_LIMITS.ADMIN_READ
    );
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Muitas requisições. Tente novamente em alguns segundos." },
        { status: 429 }
      );
    }

    const { id } = await params;

    const license = await prisma.license.findUnique({
      where: { id },
      include: {
        client: {
          select: { id: true, name: true, slug: true },
        },
        logs: {
          orderBy: { createdAt: "desc" },
          take: 100,
        },
      },
    });

    if (!license) {
      return NextResponse.json(
        { error: "Licenca nao encontrada" },
        { status: 404 }
      );
    }

    const now = new Date();

    return NextResponse.json({
      ok: true,
      license: {
        id: license.id,
        token: license.token,
        plan: license.plan,
        expiresAt: license.expiresAt.toISOString(),
        createdAt: license.createdAt.toISOString(),
        isActive: license.expiresAt > now,
        client: {
          id: license.client.id,
          name: license.client.name,
          slug: license.client.slug,
        },
        features: license.features,
        limits: license.limits,
        logs: license.logs.map((log) => ({
          id: log.id,
          valid: log.valid,
          reason: log.reason,
          ip: log.ip,
          createdAt: log.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error("Error getting license:", error);
    return NextResponse.json(
      { error: "Erro ao buscar licenca" },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/licenses/[id] - Update license (extend, change plan, revoke)
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
      `admin_license_write:${session.user.id}`,
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
    const { revoke, extendDays, plan, features, limits } = body;

    const license = await prisma.license.findUnique({
      where: { id },
    });

    if (!license) {
      return NextResponse.json(
        { error: "Licenca nao encontrada" },
        { status: 404 }
      );
    }

    const updateData: {
      expiresAt?: Date;
      plan?: string;
      features?: object;
      limits?: object;
    } = {};

    // Revoke: set expiration to now
    if (revoke) {
      updateData.expiresAt = new Date();
    }
    // Extend: add days to current expiration
    else if (extendDays && extendDays > 0) {
      const baseDate = license.expiresAt > new Date() ? license.expiresAt : new Date();
      updateData.expiresAt = new Date(
        baseDate.getTime() + extendDays * 24 * 60 * 60 * 1000
      );
    }

    if (plan) {
      updateData.plan = plan;
    }

    if (features !== undefined) {
      updateData.features = features;
    }

    if (limits !== undefined) {
      updateData.limits = limits;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "Nenhum campo para atualizar" },
        { status: 400 }
      );
    }

    const updated = await prisma.license.update({
      where: { id },
      data: updateData,
      include: {
        client: {
          select: { id: true, name: true },
        },
      },
    });

    // Log revocation
    if (revoke) {
      await prisma.licenseValidationLog.create({
        data: {
          licenseId: id,
          token: license.token,
          valid: false,
          reason: "REVOKED_BY_ADMIN",
          ip: "admin",
          userAgent: `admin:${session.user.email}`,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      license: {
        id: updated.id,
        token: updated.token,
        plan: updated.plan,
        expiresAt: updated.expiresAt.toISOString(),
        isActive: updated.expiresAt > new Date(),
        client: {
          id: updated.client.id,
          name: updated.client.name,
        },
      },
      action: revoke ? "revoked" : extendDays ? "extended" : "updated",
    });
  } catch (error) {
    console.error("Error updating license:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar licenca" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/licenses/[id] - Permanently delete license
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
      `admin_license_write:${session.user.id}`,
      RATE_LIMITS.ADMIN_WRITE
    );
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Muitas requisições. Tente novamente em alguns segundos." },
        { status: 429 }
      );
    }

    const { id } = await params;

    const license = await prisma.license.findUnique({
      where: { id },
    });

    if (!license) {
      return NextResponse.json(
        { error: "Licenca nao encontrada" },
        { status: 404 }
      );
    }

    // Delete validation logs first, then license
    await prisma.$transaction([
      prisma.licenseValidationLog.deleteMany({
        where: { licenseId: id },
      }),
      prisma.license.delete({
        where: { id },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      message: "Licenca removida permanentemente",
    });
  } catch (error) {
    console.error("Error deleting license:", error);
    return NextResponse.json(
      { error: "Erro ao remover licenca" },
      { status: 500 }
    );
  }
}
