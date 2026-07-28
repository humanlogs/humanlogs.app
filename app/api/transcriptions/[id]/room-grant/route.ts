import { withAuthRateLimit } from "@/lib/router/rate-limit-middleware";
import { createRoomGrant, type RoomRole } from "@/lib/sockets/room-grant";
import { getTranscriptionAccessFor } from "@/lib/transcriptions/access";
import { NextResponse } from "next/server";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * Issue a room grant: the signed statement the socket server checks before letting
 * this user into this transcription's collaboration and presence rooms.
 *
 * The transcription endpoint already returns one alongside the document, so opening
 * a transcript needs nothing extra. This endpoint exists for the cases where that
 * first grant is no longer good enough: an editing session longer than the grant's
 * lifetime, or a socket reconnecting after the machine was asleep. It is the ONLY
 * check between a client and a room, so it re-reads access from the database every
 * time rather than trusting anything the caller says.
 */
export const GET = withAuthRateLimit(
  async (_request, user, { params }: RouteParams) => {
    const { id } = await params;

    const access = await getTranscriptionAccessFor(user.id, id);
    if (!access.hasAccess) {
      // Deliberately the same answer whether the transcription is someone else's
      // or does not exist — a grant request must not confirm that an id is real.
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const grant = await createRoomGrant({
      userId: user.id,
      transcriptionId: id,
      role: (access.isOwner ? "owner" : access.role) as RoomRole,
    });

    return NextResponse.json({ grant });
  },
);
