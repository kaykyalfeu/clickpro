import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/setup/normalize-emails
 *
 * Normalizes all user emails to lowercase in the database.
 * This fixes login issues caused by mixed-case emails stored in the database.
 *
 * Requires SETUP_SECRET in request body for authorization.
 */
export async function POST(req: Request) {
  try {
    const setupSecret = process.env.SETUP_SECRET;
    const body = await req.json().catch(() => ({}));
    const { secret } = body;

    if (!setupSecret || secret !== setupSecret) {
      return NextResponse.json(
        { error: "Unauthorized - invalid setup secret" },
        { status: 401 }
      );
    }

    // Find all users with non-lowercase emails
    const allUsers = await prisma.user.findMany({
      select: { id: true, email: true },
    });

    const usersToFix = allUsers.filter(u => u.email !== u.email.toLowerCase().trim());

    if (usersToFix.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "All user emails are already normalized",
        updated: 0,
      });
    }

    // Check for potential conflicts
    const emailCounts = new Map<string, number>();
    for (const user of allUsers) {
      const normalized = user.email.toLowerCase().trim();
      emailCounts.set(normalized, (emailCounts.get(normalized) || 0) + 1);
    }

    const conflicts = Array.from(emailCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([email]) => email);

    if (conflicts.length > 0) {
      return NextResponse.json({
        ok: false,
        error: "Found duplicate emails that would conflict after normalization",
        conflicts,
      }, { status: 400 });
    }

    // Update all emails to lowercase
    const updated: string[] = [];

    for (const user of usersToFix) {
      const normalizedEmail = user.email.toLowerCase().trim();
      await prisma.user.update({
        where: { id: user.id },
        data: { email: normalizedEmail },
        select: { id: true },
      });
      updated.push(`${user.email} -> ${normalizedEmail}`);
    }

    console.log(`[NORMALIZE_EMAILS] Updated ${updated.length} emails:`, updated);

    return NextResponse.json({
      ok: true,
      message: `Successfully normalized ${updated.length} email(s)`,
      updated: updated.length,
      details: updated,
    });

  } catch (error) {
    console.error("Error normalizing emails:", error);
    return NextResponse.json(
      { error: "Failed to normalize emails" },
      { status: 500 }
    );
  }
}
