import { prisma } from "@/lib/prisma";
import { withAuthRateLimit } from "@/lib/router/rate-limit-middleware";
import { notifyDatabaseChange } from "@/lib/sockets/socket-helpers";
import { checkAccess, participantIds } from "@/lib/transcriptions/access";
import { NextResponse } from "next/server";

type RouteParams = {
  params: Promise<{ id: string; commentId: string }>;
};

// Edit a comment body. Only the author may edit; the pre-edit body is snapshotted
// into CommentHistory for versioning.
export const PATCH = withAuthRateLimit(
  async (request, user, { params }: RouteParams) => {
    const { id, commentId } = await params;
    const payload = await request.json();

    if (payload?.body === undefined || payload.body === null) {
      return NextResponse.json({ error: "body is required" }, { status: 400 });
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

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment || comment.transcriptionId !== id || comment.deletedAt) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // Only the author can edit their note.
    if (comment.userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.commentHistory.create({
        data: {
          commentId: comment.id,
          userId: user.id,
          body: comment.body as never,
        },
      });
      return tx.comment.update({
        where: { id: comment.id },
        data: { body: payload.body },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
    });

    for (const uid of participantIds(transcription)) {
      notifyDatabaseChange(uid, "comment", "update", { transcriptionId: id });
    }

    return NextResponse.json({
      comment: {
        id: updated.id,
        anchorId: updated.anchorId,
        userId: updated.userId,
        author: updated.user
          ? {
              id: updated.user.id,
              name: updated.user.name,
              email: updated.user.email,
            }
          : null,
        body: updated.body,
        resolved: updated.resolved,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  },
);

// Soft-delete a comment. The author or the transcription owner may delete.
export const DELETE = withAuthRateLimit(
  async (_request, user, { params }: RouteParams) => {
    const { id, commentId } = await params;

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

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment || comment.transcriptionId !== id) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    const { isOwner } = checkAccess(transcription, user.id);
    if (comment.userId !== user.id && !isOwner) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await prisma.comment.update({
      where: { id: comment.id },
      data: { deletedAt: new Date() },
    });

    for (const uid of participantIds(transcription)) {
      notifyDatabaseChange(uid, "comment", "delete", {
        transcriptionId: id,
        anchorId: comment.anchorId,
      });
    }

    // Report whether the thread is now empty so the client can drop the anchor mark.
    const remaining = await prisma.comment.count({
      where: {
        transcriptionId: id,
        anchorId: comment.anchorId,
        deletedAt: null,
      },
    });

    return NextResponse.json({ success: true, threadEmpty: remaining === 0 });
  },
);
