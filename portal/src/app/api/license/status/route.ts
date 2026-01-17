import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isSuperAdmin } from "@/lib/auth";
import { checkClientLicense, formatLicenseForResponse } from "@/lib/license";

// GET /api/license/status - Get license status for current user's client
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Nao autorizado" },
        { status: 401 }
      );
    }

    // SUPER_ADMIN doesn't need a license
    if (isSuperAdmin(session)) {
      return NextResponse.json({
        ok: true,
        license: {
          hasLicense: true,
          isValid: true,
          plan: "admin",
          expiresAt: null,
          daysRemaining: -1, // Unlimited
        },
        isSuperAdmin: true,
      });
    }

    const clientId = session.user.clientId;

    if (!clientId) {
      return NextResponse.json({
        ok: true,
        license: {
          hasLicense: false,
          isValid: false,
          plan: null,
          expiresAt: null,
          daysRemaining: 0,
        },
        error: "Usuario nao associado a um cliente",
      });
    }

    const licenseStatus = await checkClientLicense(clientId);

    return NextResponse.json({
      ok: true,
      license: formatLicenseForResponse(licenseStatus),
      clientId,
      clientName: session.user.clientName,
    });
  } catch (error) {
    console.error("Error checking license status:", error);
    return NextResponse.json(
      { error: "Erro ao verificar status da licenca" },
      { status: 500 }
    );
  }
}
