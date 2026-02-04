import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ ok: false, error: "Nao autorizado" }, { status: 401 });
  }

  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
  let prismaCanConnect = false;

  if (hasDatabaseUrl) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      prismaCanConnect = true;
    } catch (error) {
      console.error("DB health check failed:", error);
    }
  }

  return NextResponse.json({
    ok: true,
    hasDatabaseUrl,
    prismaCanConnect,
  });
}
