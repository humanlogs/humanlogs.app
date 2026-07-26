import { prisma } from "@/lib/prisma";
import { withAuthRateLimit } from "@/lib/router/rate-limit-middleware";
import { checkAccess } from "@/lib/transcriptions/access";
import { NextResponse } from "next/server";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/** The caller's thread subscriptions for this transcription. */
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
    if (!checkAccess(transcription, user.id, "read").hasAccess) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const rows = await prisma.threadSubscription.findMany({
      where: { userId: user.id, transcriptionId: id },
      select: { anchorId: true, subscribed: true },
    });

    return NextResponse.json({ subscriptions: rows });
  },
);

/**
 * Subscribe to or unsubscribe from a thread: `{ anchorId, subscribed }`.
 *
 * An explicit `subscribed: false` is stored rather than deleted, so posting in the
 * thread later doesn't silently opt the user back in.
 */
export const POST = withAuthRateLimit(
  async (request, user, { params }: RouteParams) => {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    if (!body?.anchorId || typeof body.anchorId !== "string") {
      return NextResponse.json(
        { error: "anchorId is required" },
        { status: 400 },
      );
    }
    const subscribed = body.subscribed !== false;

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
    if (!checkAccess(transcription, user.id, "read").hasAccess) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await prisma.threadSubscription.upsert({
      where: {
        userId_transcriptionId_anchorId: {
          userId: user.id,
          transcriptionId: id,
          anchorId: body.anchorId,
        },
      },
      create: {
        userId: user.id,
        transcriptionId: id,
        anchorId: body.anchorId,
        subscribed,
      },
      update: { subscribed },
    });

    return NextResponse.json({ success: true, subscribed });
  },
);
