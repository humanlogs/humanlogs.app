import { prisma } from "@/lib/prisma";
import { withAuthRateLimit } from "@/lib/router/rate-limit-middleware";
import { findAccessibleDocumentStamps } from "@/lib/transcriptions/access";
import { NextResponse } from "next/server";

/**
 * Every comment thread on a study, in one request.
 *
 * The per-document route (`/api/transcriptions/[id]/comments`) is what the editor
 * uses, and it is the right shape there: one interview is open. The excerpt table
 * asks a different question — "the notes written inside these passages" — and its
 * passages come from across the corpus, so asking per document would be one
 * request per interview on screen. This is the same rows, scoped the way the
 * table reads them.
 *
 * Bodies come back exactly as stored: end-to-end encrypted when the document is,
 * and decrypted in the browser like everywhere else. The server ships ciphertext
 * it cannot read, which is the whole arrangement.
 */

/** Deleted threads are gone, not hidden: a retracted note is not an analysis. */
const MAX_COMMENTS = 2000;

export const GET = withAuthRateLimit(async (request, user) => {
  const url = new URL(request.url);
  const documentId = url.searchParams.get("documentId");
  const study = url.searchParams.get("projectId");

  // The same three scopes the sidebar distinguishes: absent is every document,
  // `none` the ones filed in no study, otherwise that study.
  const projectId =
    study === null ? undefined : study === "none" ? null : study;

  const documents = await findAccessibleDocumentStamps(user.id, projectId);
  const readable = new Set(documents.map((doc) => doc.id));

  // A document asked for by name still has to be one this user can read — the
  // scope above is what establishes that, never the parameter.
  const ids = documentId
    ? readable.has(documentId)
      ? [documentId]
      : []
    : documents.map((doc) => doc.id);

  if (ids.length === 0) return NextResponse.json({ comments: [] });

  const comments = await prisma.comment.findMany({
    where: { transcriptionId: { in: ids }, deletedAt: null },
    orderBy: { createdAt: "asc" },
    take: MAX_COMMENTS,
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({
    comments: comments.map((c) => ({
      id: c.id,
      // Which interview it is on: the table spans the corpus, so a note has to
      // say where it was written.
      transcriptionId: c.transcriptionId,
      anchorId: c.anchorId,
      userId: c.userId,
      author: c.user
        ? { id: c.user.id, name: c.user.name, email: c.user.email }
        : null,
      body: c.body,
      resolved: c.resolved,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
  });
});
