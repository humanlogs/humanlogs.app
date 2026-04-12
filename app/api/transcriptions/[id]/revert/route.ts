import { prisma } from "@/lib/prisma";
import { notifyDatabaseChange } from "@/lib/sockets/socket-helpers";
import { NextResponse } from "next/server";
import { withAuthRateLimit } from "@/lib/router/rate-limit-middleware";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

export const POST = withAuthRateLimit(
  async (request, user, { params }: RouteParams) => {
    try {
      const { id } = await params;
      const body = await request.json();
      const { versionId } = body;

      if (!versionId || typeof versionId !== "string") {
        return NextResponse.json(
          { error: "versionId is required" },
          { status: 400 },
        );
      }

      // Fetch the transcription to verify ownership
      const transcription = await prisma.transcription.findUnique({
        where: { id },
      });

      if (!transcription) {
        return NextResponse.json(
          { error: "Transcription not found" },
          { status: 404 },
        );
      }

      if (transcription.userId !== user.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      // Fetch the version to revert to
      const version = await prisma.transcriptionHistory.findUnique({
        where: { id: versionId },
        select: {
          transcription: true,
          transcriptionId: true,
        },
      });

      if (!version || version.transcriptionId !== id) {
        return NextResponse.json(
          { error: "Version not found" },
          { status: 404 },
        );
      }

      // Save current state to history before reverting
      if (transcription.transcription !== null) {
        await prisma.transcriptionHistory.create({
          data: {
            transcriptionId: id,
            userId: user.id,
            transcription: transcription.transcription as never,
            updatedBy: user.id,
          },
        });
      }

      // Update the transcription with the old version
      const updated = await prisma.transcription.update({
        where: { id },
        data: {
          transcription: version.transcription as never,
        },
      });

      // Notify client of transcription update
      notifyDatabaseChange(user.id, "transcription", "update", {
        id: updated.id,
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error reverting version:", error);
      return NextResponse.json(
        { error: "Failed to revert version" },
        { status: 500 },
      );
    }
  },
);
