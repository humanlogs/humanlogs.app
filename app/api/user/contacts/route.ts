import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { withAuthRateLimit } from "@/lib/router/rate-limit-middleware";
import { findShareContacts } from "@/lib/transcriptions/access";

/**
 * People the current user already shares documents with, most recent first —
 * the suggestions offered by the share dialog. See `findShareContacts` for why
 * this is the boundary rather than a search over every account.
 */
export const GET = withAuthRateLimit(async (_request, user) => {
  try {
    const contacts = await findShareContacts(user.id);
    if (contacts.length === 0) {
      return NextResponse.json({ contacts: [] });
    }

    const users = await prisma.user.findMany({
      where: { id: { in: contacts.map((c) => c.userId) } },
      select: { id: true, name: true, email: true, picture: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));

    return NextResponse.json({
      // A share can outlive its user (account deleted): drop those.
      contacts: contacts.flatMap((c) => {
        const u = byId.get(c.userId);
        return u ? [u] : [];
      }),
    });
  } catch (error) {
    console.error("Error fetching share contacts:", error);
    return NextResponse.json(
      { error: "Failed to fetch contacts" },
      { status: 500 },
    );
  }
});
