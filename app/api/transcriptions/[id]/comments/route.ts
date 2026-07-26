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

    return NextResponse.json({ comment: toDTO(created) });
  },
);

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
