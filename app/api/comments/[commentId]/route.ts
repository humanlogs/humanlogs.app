import { prisma } from "@/lib/prisma";
import { withAuthRateLimit } from "@/lib/router/rate-limit-middleware";
import { NextResponse } from "next/server";

/**
 * Editing and retracting a note on a SLICE.
 *
 * Only the author's own, and only a slice note: a passage note is anchored in a
 * transcript and its route already weighs write access to that document against
 * the mark it would leave behind. Sending one here would skip that check, so this
 * refuses it rather than being clever.
 */

type RouteParams = { params: Promise<{ commentId: string }> };

const MAX_BODY = 20_000;

async function ownSliceNote(commentId: string, userId: string) {
  const note = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, userId: true, anchorType: true, deletedAt: true },
  });
  if (!note || note.deletedAt) return null;
  if (note.userId !== userId) return null;
  if (note.anchorType !== "slice") return null;
  return note;
}

export const PATCH = withAuthRateLimit(
  async (request, user, { params }: RouteParams) => {
    const { commentId } = await params;
    const input = (await request.json()) as { body?: unknown };

    if (input.body === undefined || input.body === null) {
      return NextResponse.json({ error: "body is required" }, { status: 400 });
    }
    if (JSON.stringify(input.body).length > MAX_BODY * 2) {
      return NextResponse.json({ error: "note is too long" }, { status: 400 });
    }
    if (!(await ownSliceNote(commentId, user.id))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await prisma.comment.update({
      where: { id: commentId },
      data: { body: input.body as object },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json({
      comment: {
        id: updated.id,
        transcriptionId: updated.transcriptionId,
        projectId: updated.projectId,
        anchorType: updated.anchorType,
        anchorId: updated.anchorId,
        facets: Array.isArray(updated.facets)
          ? (updated.facets as string[])
          : null,
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

/**
 * Retract a note.
 *
 * Soft, like a comment: `deletedAt` rather than a row removed, which is what the
 * rest of the comment machinery already expects and what leaves a thread's shape
 * intact when one of its notes goes.
 */
export const DELETE = withAuthRateLimit(
  async (_request, user, { params }: RouteParams) => {
    const { commentId } = await params;
    if (!(await ownSliceNote(commentId, user.id))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await prisma.comment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  },
);
