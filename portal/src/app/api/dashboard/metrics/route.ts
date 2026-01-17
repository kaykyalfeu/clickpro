import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions, isSuperAdmin } from "@/lib/auth";

// GET /api/dashboard/metrics - Get dashboard metrics
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Nao autorizado" },
        { status: 401 }
      );
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Different metrics based on role
    if (isSuperAdmin(session)) {
      // SUPER_ADMIN gets system-wide metrics
      const [
        totalClients,
        totalUsers,
        totalLicenses,
        activeLicenses,
        expiringLicenses,
        validationsLast24h,
        successfulValidations24h,
        failedValidations24h,
        usersCreatedLast7d,
        usersCreatedLast30d,
        recentUsers,
      ] = await Promise.all([
        prisma.client.count(),
        prisma.user.count(),
        prisma.license.count(),
        prisma.license.count({
          where: { expiresAt: { gt: now } },
        }),
        prisma.license.count({
          where: {
            expiresAt: {
              gt: now,
              lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
            },
          },
        }),
        prisma.licenseValidationLog.count({
          where: { createdAt: { gt: twentyFourHoursAgo } },
        }),
        prisma.licenseValidationLog.count({
          where: { createdAt: { gt: twentyFourHoursAgo }, valid: true },
        }),
        prisma.licenseValidationLog.count({
          where: { createdAt: { gt: twentyFourHoursAgo }, valid: false },
        }),
        prisma.user.count({
          where: { createdAt: { gt: sevenDaysAgo } },
        }),
        prisma.user.count({
          where: { createdAt: { gt: thirtyDaysAgo } },
        }),
        prisma.user.findMany({
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
            memberships: {
              include: {
                client: { select: { name: true } },
              },
              take: 1,
            },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
      ]);

      // Calculate validation success rate
      const validationSuccessRate = validationsLast24h > 0
        ? Math.round((successfulValidations24h / validationsLast24h) * 100)
        : 100;

      return NextResponse.json({
        ok: true,
        role: "SUPER_ADMIN",
        metrics: {
          clients: {
            total: totalClients,
          },
          users: {
            total: totalUsers,
            createdLast7d: usersCreatedLast7d,
            createdLast30d: usersCreatedLast30d,
          },
          licenses: {
            total: totalLicenses,
            active: activeLicenses,
            expiringSoon: expiringLicenses,
          },
          validations: {
            last24h: validationsLast24h,
            successful: successfulValidations24h,
            failed: failedValidations24h,
            successRate: validationSuccessRate,
          },
        },
        recentUsers: recentUsers.map((user) => ({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          createdAt: user.createdAt.toISOString(),
          clientName: user.memberships[0]?.client?.name ?? null,
        })),
      });
    } else {
      // CLIENT_ADMIN/CLIENT_USER gets their client's metrics
      const clientId = session.user.clientId;

      if (!clientId) {
        return NextResponse.json({
          ok: true,
          role: session.user.role,
          metrics: null,
          error: "Usuario nao associado a um cliente",
        });
      }

      const [
        client,
        totalMembers,
        activeLicenses,
        validationsLast24h,
        successfulValidations24h,
      ] = await Promise.all([
        prisma.client.findUnique({
          where: { id: clientId },
          select: { name: true, createdAt: true },
        }),
        prisma.clientMember.count({
          where: { clientId },
        }),
        prisma.license.count({
          where: { clientId, expiresAt: { gt: now } },
        }),
        prisma.licenseValidationLog.count({
          where: {
            createdAt: { gt: twentyFourHoursAgo },
            license: { clientId },
          },
        }),
        prisma.licenseValidationLog.count({
          where: {
            createdAt: { gt: twentyFourHoursAgo },
            license: { clientId },
            valid: true,
          },
        }),
      ]);

      // Get active license details
      const activeLicense = await prisma.license.findFirst({
        where: { clientId, expiresAt: { gt: now } },
        orderBy: { expiresAt: "desc" },
      });

      const daysRemaining = activeLicense
        ? Math.ceil((activeLicense.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      return NextResponse.json({
        ok: true,
        role: session.user.role,
        clientName: client?.name,
        metrics: {
          members: totalMembers,
          licenses: {
            active: activeLicenses,
            plan: activeLicense?.plan ?? null,
            expiresAt: activeLicense?.expiresAt.toISOString() ?? null,
            daysRemaining,
          },
          validations: {
            last24h: validationsLast24h,
            successful: successfulValidations24h,
          },
        },
      });
    }
  } catch (error) {
    console.error("Error fetching dashboard metrics:", error);
    return NextResponse.json(
      { error: "Erro ao buscar metricas" },
      { status: 500 }
    );
  }
}
