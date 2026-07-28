import {
  NOTIFICATION_TYPES,
  createNotifications,
} from "@/lib/notifications/notifications";
import { prisma } from "@/lib/prisma";
import { withAuthRateLimit } from "@/lib/router/rate-limit-middleware";
import { notifyDatabaseChange } from "@/lib/sockets/socket-helpers";
import { checkAccess, participantIds } from "@/lib/transcriptions/access";
import { NextResponse } from "next/server";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/** Serialize a Comment row (+ author) into the shape the client expects. */
function toDTO(c: {
  id: string;
  anchorId: string;
  userId: string;
  body: unknown;
  resolved: boolean;
  createdAt: Date;
  updatedAt: Date;
  user?: { id: string; name: string | null; email: string } | null;
}) {
  return {
    id: c.id,
    anchorId: c.anchorId,
    userId: c.userId,
    author: c.user
      ? { id: c.user.id, name: c.user.name, email: c.user.email }
      : null,
    body: c.body,
    resolved: c.resolved,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

// List all (non-deleted) comments for a transcription. Requires read access.
export const GET = withAuthRateLimit(
  async (_request, user, { params }: RouteParams) => {
    const { id } = await params;

    const transcription = await prisma.transcription.findUnique({
      where: { id },
      select: { userId: true, shared: true },
    });
    if (!transcription) {
      return NextResponse.json(
        { error: "Transcription not found" },
        { status: 404 },
      );
    }

    const { hasAccess } = checkAccess(transcription, user.id, "read");
    if (!hasAccess) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const comments = await prisma.comment.findMany({
      where: { transcriptionId: id, deletedAt: null },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json({ comments: comments.map(toDTO) });
  },
);

// Create a comment (a note in a thread). Requires write access because adding a
// comment anchors a `comment` mark into the transcript itself.
export const POST = withAuthRateLimit(
  async (request, user, { params }: RouteParams) => {
    const { id } = await params;
    const body = await request.json();

    if (!body?.anchorId || typeof body.anchorId !== "string") {
      return NextResponse.json(
        { error: "anchorId is required" },
        { status: 400 },
      );
    }
    if (body.body === undefined || body.body === null) {
      return NextResponse.json(
        { error: "body is required" },
        { status: 400 },
      );
    }

    const transcription = await prisma.transcription.findUnique({
      where: { id },
      select: { userId: true, shared: true },
    });
    if (!transcription) {
      return NextResponse.json(
        { error: "Transcription not found" },
        { status: 404 },
      );
    }

    const { hasAccess } = checkAccess(transcription, user.id, "write");
    if (!hasAccess) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const created = await prisma.comment.create({
      data: {
        transcriptionId: id,
        anchorId: body.anchorId,
        userId: user.id,
        body: body.body,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    for (const uid of participantIds(transcription)) {
      notifyDatabaseChange(uid, "comment", "create", { transcriptionId: id });
    }

    // Mentions arrive as a plain list of user ids alongside the encrypted body: the
    // mention token itself lives inside the ciphertext, so the server could not
    // otherwise know who to notify. Only the ids are exposed, never the text — and
    // only for people who already have access to the transcription.
    const mentioned = (
      Array.isArray(body.mentions) ? (body.mentions as unknown[]) : []
    ).filter((m): m is string => typeof m === "string");
    const allowed = new Set(participantIds(transcription));
    const mentionedWithAccess = Array.from(new Set(mentioned)).filter((m) =>
      allowed.has(m),
    );

    await notifyThread({
      transcriptionId: id,
      anchorId: body.anchorId,
      commentId: created.id,
      actorId: user.id,
      mentioned: mentionedWithAccess,
    });

    return NextResponse.json({ comment: toDTO(created) });
  },
);

/**
 * Subscribe the author (and anyone they mentioned) to the thread, then notify:
 * mentioned people get a mention notification, the thread's other subscribers get a
 * reply. Best-effort — a notification failure must never fail posting the comment.
 */
async function notifyThread({
  transcriptionId,
  anchorId,
  commentId,
  actorId,
  mentioned,
}: {
  transcriptionId: string;
  anchorId: string;
  commentId: string;
  actorId: string;
  mentioned: string[];
}): Promise<void> {
  try {
    // Posting in a thread, or being mentioned in it, subscribes you — unless you
    // previously opted out, which `subscribed: false` records.
    for (const userId of new Set([actorId, ...mentioned])) {
      await prisma.threadSubscription.upsert({
        where: {
          userId_transcriptionId_anchorId: { userId, transcriptionId, anchorId },
        },
        create: { userId, transcriptionId, anchorId, subscribed: true },
        update: {},
      });
    }

    const subscribers = await prisma.threadSubscription.findMany({
      where: { transcriptionId, anchorId, subscribed: true },
      select: { userId: true },
    });

    const mentionedSet = new Set(mentioned);
    const payload = { transcriptionId, anchorId, commentId };

    await createNotifications({
      recipients: mentioned,
      type: NOTIFICATION_TYPES.commentMention,
      actorId,
      entityType: "transcription",
      entityId: transcriptionId,
      data: payload,
    });

    // A mention already notified them; don't send a reply notification as well.
    await createNotifications({
      recipients: subscribers
        .map((s) => s.userId)
        .filter((uid) => !mentionedSet.has(uid)),
      type: NOTIFICATION_TYPES.commentReply,
      actorId,
      entityType: "transcription",
      entityId: transcriptionId,
      data: payload,
    });
  } catch (error) {
    console.error("[comments] notification step failed", error);
  }
}

// Bulk-replace comment bodies. Used when sharing a transcription with a new user:
// the owner re-wraps each encrypted comment body's AES key for the new accessor
// client-side and pushes the updated bodies here. Owner only.
export const PUT = withAuthRateLimit(
  async (request, user, { params }: RouteParams) => {
    const { id } = await params;
    const payload = await request.json();

    const updates: Array<{ id: string; body: unknown }> = Array.isArray(
      payload?.comments,
    )
      ? payload.comments
      : [];
    if (updates.length === 0) {
      return NextResponse.json({ success: true, updated: 0 });
    }

    const transcription = await prisma.transcription.findUnique({
      where: { id },
      select: { userId: true, shared: true },
    });
    if (!transcription) {
      return NextResponse.json(
        { error: "Transcription not found" },
        { status: 404 },
      );
    }

    const { isOwner } = checkAccess(transcription, user.id);
    if (!isOwner) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Only touch comments that actually belong to this transcription.
    const ids = updates.map((u) => u.id);
    const owned = await prisma.comment.findMany({
      where: { id: { in: ids }, transcriptionId: id },
      select: { id: true },
    });
    const ownedSet = new Set(owned.map((c) => c.id));

    await prisma.$transaction(
      updates
        .filter((u) => u.body != null && ownedSet.has(u.id))
        .map((u) =>
          prisma.comment.update({
            where: { id: u.id },
            data: { body: u.body as never },
          }),
        ),
    );

    return NextResponse.json({ success: true, updated: ownedSet.size });
  },
);
