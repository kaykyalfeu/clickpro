import { NextResponse } from "next/server";

// TODO: Import Prisma client for database lookups
// import { prisma } from "@/lib/prisma";

interface ValidateLicenseRequest {
  licenseKey: string;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ValidateLicenseRequest;

    // Validate required fields
    if (!body.licenseKey || typeof body.licenseKey !== "string") {
      return NextResponse.json(
        { ok: false, error: "licenseKey é obrigatório" },
        { status: 400 }
      );
    }

    const licenseKey = body.licenseKey.trim();

    if (!licenseKey) {
      return NextResponse.json(
        { ok: false, error: "licenseKey não pode estar vazio" },
        { status: 400 }
      );
    }

    // TODO: Look up license in database using Prisma
    // const license = await prisma.license.findUnique({
    //   where: { token: licenseKey },
    // });
    //
    // if (!license) {
    //   return NextResponse.json({
    //     ok: true,
    //     valid: false,
    //     reason: "LICENSE_NOT_FOUND",
    //   });
    // }
    //
    // const now = new Date();
    // if (license.expiresAt < now) {
    //   return NextResponse.json({
    //     ok: true,
    //     valid: false,
    //     reason: "EXPIRED",
    //     expiresAt: license.expiresAt.toISOString(),
    //   });
    // }
    //
    // return NextResponse.json({
    //   ok: true,
    //   valid: true,
    //   expiresAt: license.expiresAt.toISOString(),
    // });

    // STUB LOGIC: For testing purposes
    // - Keys containing "EXPIRED" are marked as invalid
    // - All other non-empty keys are treated as valid

    if (licenseKey.toUpperCase().includes("EXPIRED")) {
      return NextResponse.json({
        ok: true,
        valid: false,
        reason: "EXPIRED",
        expiresAt: new Date(Date.now() - 86400000).toISOString(), // Yesterday
      });
    }

    // Simulate a valid license expiring in 30 days
    const expiresAt = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    return NextResponse.json({
      ok: true,
      valid: true,
      expiresAt,
    });
  } catch (error) {
    console.error("License validation error:", error);
    return NextResponse.json(
      { ok: false, error: "Falha ao validar licença" },
      { status: 500 }
    );
  }
}
