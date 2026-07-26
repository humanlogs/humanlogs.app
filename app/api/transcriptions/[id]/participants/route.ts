import { prisma } from "@/lib/prisma";
import { withAuthRateLimit } from "@/lib/router/rate-limit-middleware";
import { checkAccess, type SharedUser } from "@/lib/transcriptions/access";
import { NextResponse } from "next/server";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * Everyone with access to a transcription (owner + shared users), with display names.
 *
 * The share dialog resolves these one id at a time; comment @-mentions need the whole
 * set at once to offer a picker. Any collaborator may read it — you can already see who
 * else is in a document from its comments and live cursors.
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

    const shared = (transcription.shared as SharedUser[] | null) || [];
    const ids = Array.from(
      new Set([transcription.userId, ...shared.map((s) => s.userId)]),
    );

    const users = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, email: true, picture: true },
    });

    const roleById = new Map(shared.map((s) => [s.userId, s.role as string]));

    return NextResponse.json({
      participants: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        picture: u.picture,
        role: u.id === transcription.userId ? "owner" : roleById.get(u.id),
      })),
    });
  },
);
