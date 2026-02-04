import "server-only";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.user.count();
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database error";
    const maybeCode = typeof error === "object" && error !== null ? (error as { code?: string }).code : undefined;
    const code = typeof maybeCode === "string" ? maybeCode : "UNKNOWN";
    const safeMessage = message.split("\n")[0];

    console.error("DB health check failed:", { code, message: safeMessage });
    return NextResponse.json(
      { ok: false, code, message: safeMessage },
      { status: 500 }
    );
  }
}
