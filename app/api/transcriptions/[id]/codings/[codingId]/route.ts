import { prisma } from "@/lib/prisma";
import { withAuthRateLimit } from "@/lib/router/rate-limit-middleware";
import { notifyDatabaseChange } from "@/lib/sockets/socket-helpers";
import { checkAccess, participantIds } from "@/lib/transcriptions/access";
import { NextResponse } from "next/server";

type RouteParams = {
  params: Promise<{ id: string; codingId: string }>;
};

/**
 * Remove a coding. Author only — a coding is one researcher's reading of a passage,
 * so nobody else gets to retract it, not even the document's owner. (Deleting the
 * document itself still cascades, which is a different decision.)
 */
export const DELETE = withAuthRateLimit(
  async (_request, user, { params }: RouteParams) => {
    const { id, codingId } = await params;

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

    const coding = await prisma.coding.findUnique({
      where: { id: codingId },
      select: { transcriptionId: true, userId: true },
    });
    // Already gone, or never on this document: the client's goal is met either way,
    // and saying which of the two would leak the existence of other people's codings.
    if (!coding || coding.transcriptionId !== id) {
      return NextResponse.json({ success: true });
    }
    if (coding.userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await prisma.coding.delete({ where: { id: codingId } });

    for (const uid of participantIds(transcription)) {
      notifyDatabaseChange(uid, "coding", "delete", { transcriptionId: id });
    }

    return NextResponse.json({ success: true });
  },
);
