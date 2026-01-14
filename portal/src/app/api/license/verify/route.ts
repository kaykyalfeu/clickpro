import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { verifyLicense } from "@/lib/license";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  const ua = req.headers.get("user-agent") || undefined;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;

  const body = await req.json().catch(() => null);
  const token = body?.licenseKey as string | undefined;

  if (!token) {
    await prisma.licenseValidationLog.create({
      data: { token: "MISSING", valid: false, reason: "MISSING_TOKEN", ip, userAgent: ua }
    });
    return NextResponse.json({ valid: false, reason: "MISSING_TOKEN" }, { status: 400 });
  }

  const secret = process.env.LICENSE_SIGNING_SECRET!;
  const res = verifyLicense(token, secret);

  // tenta vincular ao License do banco (se existir)
  const dbLicense = await prisma.license.findUnique({ where: { token } }).catch(() => null);

  await prisma.licenseValidationLog.create({
    data: {
      token,
      valid: res.ok,
      reason: res.ok ? null : res.reason,
      ip,
      userAgent: ua,
      licenseId: dbLicense?.id
    }
  });

  if (!res.ok) {
    return NextResponse.json({ valid: false, reason: res.reason }, { status: 200 });
  }

  return NextResponse.json({
    valid: true,
    expiresAt: res.payload.expiresAt,
    plan: res.payload.plan,
    limits: res.payload.limits,
    features: res.payload.features
  }, { status: 200 });
}
