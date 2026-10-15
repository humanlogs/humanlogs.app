import { anchorColumns, sliceAnchor } from "@/lib/comments/anchor";
import { prisma } from "@/lib/prisma";
import { withAuthRateLimit } from "@/lib/router/rate-limit-middleware";
import { findAccessibleDocumentStamps } from "@/lib/transcriptions/access";
import { NextResponse } from "next/server";

/**
 * Notes across a study — both kinds.
 *
 * The per-document route (`/api/transcriptions/[id]/comments`) is what the editor
 * uses, and it is the right shape there: one interview is open. The excerpt table
 * asks a different question — "the notes written about these passages, and about
 * this slice of the corpus" — and its passages come from across the study, so
 * asking per document would be one request per interview on screen.
 *
 * Bodies come back exactly as stored: end-to-end encrypted when the document is,
 * and decrypted in the browser like everywhere else. The server ships ciphertext
 * it cannot read, which is the whole arrangement — and now true of a slice note
 * too, which the `Analysis` table this replaces stored in clear.
 */

const MAX_COMMENTS = 2000;
/** A slice is a handful of facets; anything larger is not a question anyone asked. */
const MAX_FACETS = 32;
const MAX_BODY = 20_000;

type Row = {
  id: string;
  transcriptionId: string | null;
  projectId: string | null;
  anchorType: string;
  anchorId: string;
  facets: unknown;
  userId: string;
  body: unknown;
  resolved: boolean;
  createdAt: Date;
  updatedAt: Date;
  user?: { id: string; name: string | null; email: string } | null;
};

function toDTO(c: Row) {
  return {
    id: c.id,
    // Which interview it is on: the table spans the corpus, so a note has to say
    // where it was written. Null on a slice note, which is about the question.
    transcriptionId: c.transcriptionId,
    projectId: c.projectId,
    anchorType: c.anchorType,
    anchorId: c.anchorId,
    facets: Array.isArray(c.facets) ? (c.facets as string[]) : null,
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

async function ownsStudy(projectId: string, userId: string): Promise<boolean> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  return !!project;
}

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

  // Slice notes hang off the study, not off a document, so they are a second
  // branch of the same query rather than a second request: the panel needs both
  // halves to draw one column.
  const slices =
    study && study !== "none" && (await ownsStudy(study, user.id))
      ? { projectId: study, anchorType: "slice" }
      : null;

  const where = slices
    ? { deletedAt: null, OR: [{ transcriptionId: { in: ids } }, slices] }
    : { deletedAt: null, transcriptionId: { in: ids } };

  if (ids.length === 0 && !slices) {
    return NextResponse.json({ comments: [] });
  }

  const comments = await prisma.comment.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: MAX_COMMENTS,
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({ comments: comments.map(toDTO) });
});

/**
 * Write a note on a SLICE.
 *
 * Passage notes keep their own route, where write access to the transcript is the
 * rule — adding one anchors a mark in the document. A slice note anchors nothing:
 * it is about a question, so owning the study is the whole of it.
 *
 * The anchor key is recomputed here from the facets rather than trusted: it alone
 * decides which thread a future view finds, and a client that sorted differently
 * would silently open a second thread on the same slice.
 */
export const POST = withAuthRateLimit(async (request, user) => {
  const input = (await request.json()) as {
    projectId?: unknown;
    facets?: unknown;
    body?: unknown;
  };

  const projectId =
    typeof input.projectId === "string" ? input.projectId : null;
  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400 },
    );
  }
  if (
    !Array.isArray(input.facets) ||
    input.facets.some((facet) => typeof facet !== "string")
  ) {
    return NextResponse.json(
      { error: "facets must be an array of strings" },
      { status: 400 },
    );
  }
  if (input.facets.length > MAX_FACETS) {
    return NextResponse.json({ error: "too many facets" }, { status: 400 });
  }
  if (input.body === undefined || input.body === null) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }
  if (JSON.stringify(input.body).length > MAX_BODY * 2) {
    return NextResponse.json({ error: "note is too long" }, { status: 400 });
  }
  if (!(await ownsStudy(projectId, user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const anchor = sliceAnchor(projectId, input.facets as string[]);
  const created = await prisma.comment.create({
    data: {
      ...anchorColumns(anchor),
      facets: anchor.facets,
      userId: user.id,
      body: input.body as object,
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({ comment: toDTO(created) });
});
