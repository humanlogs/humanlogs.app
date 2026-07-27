import { prisma } from "@/lib/prisma";
import { notifyDatabaseChange } from "@/lib/sockets/socket-helpers";

/**
 * Generic in-app notifications.
 *
 * Nothing here knows about comments (or any other feature): a caller names an event
 * type, points at an entity, and lists recipients. Adding a notification to a new
 * feature means calling {@link createNotifications} with a new `type` and teaching the
 * client how to word it — no schema or API change.
 *
 * Payloads carry only what a one-line summary and a link need. In particular, comment
 * bodies are end-to-end encrypted, so notifications reference a comment instead of
 * quoting it; the recipient's client decrypts if it wants to show more.
 */

/** Event names in use. Free-form by design — unknown types get a generic wording. */
export const NOTIFICATION_TYPES = {
  commentMention: "comment.mention",
  commentReply: "comment.reply",
} as const;

export type NotificationInput = {
  /** Recipients. Deduplicated; `actorId` is removed so nobody notifies themselves. */
  recipients: string[];
  type: string;
  actorId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  /** Small, non-sensitive metadata used for rendering and linking. */
  data?: Record<string, unknown>;
};

/**
 * Create one notification per recipient and push a live update to each of them.
 * Returns the number created. Never throws into the caller's request path — a failed
 * notification must not fail the action that triggered it.
 */
export async function createNotifications({
  recipients,
  type,
  actorId,
  entityType,
  entityId,
  data,
}: NotificationInput): Promise<number> {
  const targets = Array.from(new Set(recipients.filter(Boolean))).filter(
    (id) => id !== actorId,
  );
  if (targets.length === 0) return 0;

  try {
    await prisma.notification.createMany({
      data: targets.map((userId) => ({
        userId,
        type,
        actorId: actorId ?? null,
        entityType: entityType ?? null,
        entityId: entityId ?? null,
        data: (data ?? {}) as never,
      })),
    });

    // Reuses the existing db:change channel: clients invalidate any query whose key
    // mentions the table, so the bell refreshes without a bespoke socket event.
    for (const userId of targets) {
      notifyDatabaseChange(userId, "notification", "create", { type });
    }
    return targets.length;
  } catch (error) {
    console.error("[notifications] failed to create", { type, error });
    return 0;
  }
}

/** Unread count for a user. */
export function countUnread(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}
