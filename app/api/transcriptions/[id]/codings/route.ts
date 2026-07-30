import { parseCodingInput, type CodingDTO } from "@/lib/codebooks/coding";
import { prisma } from "@/lib/prisma";
import { withAuthRateLimit } from "@/lib/router/rate-limit-middleware";
import { notifyDatabaseChange } from "@/lib/sockets/socket-helpers";
import { checkAccess, participantIds } from "@/lib/transcriptions/access";
import { NextResponse } from "next/server";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/** Serialize a Coding row (+ author) into the shape the client expects. */
function toDTO(c: {
  id: string;
  userId: string;
  codebookId: string;
  codeId: string;
  createdAt: Date;
  user?: { id: string; name: string | null; email: string } | null;
}): CodingDTO {
  return {
    id: c.id,
    userId: c.userId,
    author: c.user
      ? { id: c.user.id, name: c.user.name, email: c.user.email }
      : null,
    codebookId: c.codebookId,
    codeId: c.codeId,
    createdAt: c.createdAt.toISOString(),
  };
}

/**
 * Every coding on this document, whoever wrote it. The "my codes only" filter is
 * applied client-side rather than here: switching between the two is a toggle in the
 * coding bar, and refetching the whole document's codings on every flick of it would
 * make a reading aid feel like a page load.
 *
 * Requires read access — a coding says nothing the transcript does not already say.
 */
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

    const codings = await prisma.coding.findMany({
      where: { transcriptionId: id },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json({ codings: codings.map(toDTO) });
  },
);

/**
 * Apply a code to a passage. Requires WRITE access, because the passage itself is
 * anchored by a mark in the transcript — coding a document edits it.
 *
 * The id comes from the client: the mark has to carry it before the row can exist,
 * exactly as a comment anchor does. The author never does — it is the session's user,
 * so a coding cannot be attributed to someone else.
 */
export const POST = withAuthRateLimit(
  async (request, user, { params }: RouteParams) => {
    const { id } = await params;
    const body = await request.json();

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

    // Only the caller's own codebooks: the codebook list is owner-scoped, so a
    // reference to anything else could not have come from a legitimate client.
    const owned = await prisma.codebook.findMany({
      where: { userId: user.id },
      select: { id: true },
    });
    const parsed = parseCodingInput(
      body,
      new Set(owned.map((c) => c.id)),
    );
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const created = await prisma.coding.create({
      data: {
        id: parsed.data.id,
        transcriptionId: id,
        userId: user.id,
        codebookId: parsed.data.codebookId,
        codeId: parsed.data.codeId,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    for (const uid of participantIds(transcription)) {
      notifyDatabaseChange(uid, "coding", "create", { transcriptionId: id });
    }

    return NextResponse.json({ coding: toDTO(created) });
  },
);
