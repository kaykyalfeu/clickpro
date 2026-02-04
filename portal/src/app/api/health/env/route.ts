import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.DATABASE_URL;
  return NextResponse.json({
    hasDatabaseUrl: Boolean(url),
    startsWithPostgres: Boolean(
      url?.startsWith("postgresql://") || url?.startsWith("postgres://")
    ),
    length: url?.length ?? 0,
  });
}
