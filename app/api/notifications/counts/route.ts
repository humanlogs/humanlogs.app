import { prisma } from "@/lib/prisma";
import { withAuthRateLimit } from "@/lib/router/rate-limit-middleware";
import { NextResponse } from "next/server";

/**
 * Unread counts, grouped by the entity each notification concerns.
 *
 * Lets a list show a badge per row (documents in the sidebar today, anything else
 * later) without fetching the notifications themselves. Entity-driven like the rest of
 * the system, so no feature is named here.
 */
export const GET = withAuthRateLimit(async (_request, user) => {
  const rows = await prisma.notification.groupBy({
    by: ["entityType", "entityId"],
    where: { userId: user.id, readAt: null },
    _count: { _all: true },
  });

  const byEntity = rows
    .filter((r) => r.entityType && r.entityId)
    .map((r) => ({
      entityType: r.entityType as string,
      entityId: r.entityId as string,
      count: r._count._all,
    }));

  return NextResponse.json({
    total: byEntity.reduce((sum, r) => sum + r.count, 0),
    byEntity,
  });
});
