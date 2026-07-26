import { countUnread } from "@/lib/notifications/notifications";
import { prisma } from "@/lib/prisma";
import { withAuthRateLimit } from "@/lib/router/rate-limit-middleware";
import { NextResponse } from "next/server";

/**
 * The signed-in user's notifications, newest first, plus the unread count.
 * Feature-agnostic: the client decides how to word each `type`.
 */
export const GET = withAuthRateLimit(async (request, user) => {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 20, 50);
  const unreadOnly = searchParams.get("unread") === "true";

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id, ...(unreadOnly ? { readAt: null } : {}) },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  // Hydrate the actors in one query so the client can show who did what.
  const actorIds = Array.from(
    new Set(notifications.map((n) => n.actorId).filter(Boolean) as string[]),
  );
  const actors = actorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true, email: true, picture: true },
      })
    : [];
  const actorById = new Map(actors.map((a) => [a.id, a]));

  // Titles are stored in the clear, so they can safely label a notification.
  const transcriptionIds = Array.from(
    new Set(
      notifications
        .filter((n) => n.entityType === "transcription" && n.entityId)
        .map((n) => n.entityId as string),
    ),
  );
  const transcriptions = transcriptionIds.length
    ? await prisma.transcription.findMany({
        where: { id: { in: transcriptionIds } },
        select: { id: true, title: true },
      })
    : [];
  const titleById = new Map(transcriptions.map((t) => [t.id, t.title]));

  return NextResponse.json({
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      actor: n.actorId ? (actorById.get(n.actorId) ?? null) : null,
      entityType: n.entityType,
      entityId: n.entityId,
      entityTitle:
        n.entityType === "transcription" && n.entityId
          ? (titleById.get(n.entityId) ?? null)
          : null,
      data: n.data,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    })),
    unreadCount: await countUnread(user.id),
  });
});

/**
 * Mark notifications as read: `{ ids: [...] }` for specific ones, or `{ all: true }`.
 */
export const PATCH = withAuthRateLimit(async (request, user) => {
  const body = await request.json().catch(() => ({}));

  if (body?.all === true) {
    await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
  } else if (Array.isArray(body?.ids) && body.ids.length > 0) {
    await prisma.notification.updateMany({
      // Scoped to the caller, so ids belonging to someone else are no-ops.
      where: { id: { in: body.ids as string[] }, userId: user.id },
      data: { readAt: new Date() },
    });
  } else {
    return NextResponse.json(
      { error: "Provide ids[] or all=true" },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true, unreadCount: await countUnread(user.id) });
});
