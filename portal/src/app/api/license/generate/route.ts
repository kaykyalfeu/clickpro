import { NextResponse } from "next/server";
import crypto from "crypto";

// TODO: Import Prisma client for database persistence
// import { prisma } from "@/lib/prisma";

interface GenerateLicenseRequest {
  customerName?: string;
  email?: string;
  expiresInDays: number;
  notes?: string;
}

function generateLicenseKey(): string {
  // Generate a unique license key in format: XXXX-XXXX-XXXX-XXXX
  const segments: string[] = [];
  for (let i = 0; i < 4; i++) {
    const segment = crypto.randomBytes(2).toString("hex").toUpperCase();
    segments.push(segment);
  }
  return segments.join("-");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GenerateLicenseRequest;

    // Validate required fields
    if (
      !body.expiresInDays ||
      body.expiresInDays < 1 ||
      body.expiresInDays > 3650
    ) {
      return NextResponse.json(
        { ok: false, error: "expiresInDays deve estar entre 1 e 3650" },
        { status: 400 }
      );
    }

    // Generate license key
    const licenseKey = generateLicenseKey();

    // Calculate dates
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(
      Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000
    ).toISOString();

    // TODO: Persist to database using Prisma
    // await prisma.license.create({
    //   data: {
    //     token: licenseKey,
    //     clientId: "...", // Need to create or lookup client
    //     plan: "standard",
    //     expiresAt: new Date(expiresAt),
    //     features: {},
    //     limits: {},
    //   },
    // });

    // TODO: Store customer metadata
    // customerName, email, notes

    return NextResponse.json({
      ok: true,
      licenseKey,
      issuedAt,
      expiresAt,
    });
  } catch (error) {
    console.error("License generation error:", error);
    return NextResponse.json(
      { ok: false, error: "Falha ao gerar licença" },
      { status: 500 }
    );
  }
}
