import { requireAuth } from "@/lib/auth-helpers";
import { getElevenLabsClient, isElevenLabsConfigured } from "@/lib/elevenlabs";
import { prisma } from "@/lib/prisma";
import { notifyDatabaseChange } from "@/lib/socket-helpers";
import { Transcription } from "@prisma/client";
import _ from "lodash";
import { NextResponse } from "next/server";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    // Fetch the transcription
    let transcription = await prisma.transcription.findUnique({
      where: {
        id,
      },
    });

    // Check if transcription exists
    if (!transcription) {
      return NextResponse.json(
        { error: "Transcription not found" },
        { status: 404 },
      );
    }

    // Check if user owns this transcription
    if (transcription.userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // If transcription is PENDING and we have an ElevenLabs ID, check status
    transcription = await pollPendingTranscriptions(transcription);

    // Return the transcription
    return NextResponse.json(mapTransactionDetails(transcription));
  } catch (error) {
    console.error("Error fetching transcription:", error);
    return NextResponse.json(
      { error: "Failed to fetch transcription" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    // Fetch the transcription
    const transcription = await prisma.transcription.findUnique({
      where: { id },
    });

    // Check if transcription exists
    if (!transcription) {
      return NextResponse.json(
        { error: "Transcription not found" },
        { status: 404 },
      );
    }

    // Check if user owns this transcription
    if (transcription.userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Update the transcription
    const updateData: {
      title?: string;
      projectId?: string | null;
    } = {};

    if (body.title !== undefined) {
      if (typeof body.title !== "string" || !body.title.trim()) {
        return NextResponse.json(
          { error: "Title must be a non-empty string" },
          { status: 400 },
        );
      }
      updateData.title = body.title.trim();
    }

    if (body.projectId !== undefined) {
      if (body.projectId === null) {
        updateData.projectId = null;
      } else if (typeof body.projectId === "string") {
        // Verify the project exists and belongs to the user
        const project = await prisma.project.findUnique({
          where: { id: body.projectId },
        });

        if (!project) {
          return NextResponse.json(
            { error: "Project not found" },
            { status: 404 },
          );
        }

        if (project.userId !== user.id) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        updateData.projectId = body.projectId;
      } else {
        return NextResponse.json(
          { error: "projectId must be a string or null" },
          { status: 400 },
        );
      }
    }

    const updated = await prisma.transcription.update({
      where: { id },
      data: updateData,
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Notify client of transcription update
    notifyDatabaseChange(user.id, "transcription", "update", {
      id: updated.id,
    });

    return NextResponse.json(mapTransactionDetails(updated));
  } catch (error) {
    console.error("Error updating transcription:", error);
    return NextResponse.json(
      { error: "Failed to update transcription" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    // Fetch the transcription
    const transcription = await prisma.transcription.findUnique({
      where: { id },
    });

    // Check if transcription exists
    if (!transcription) {
      return NextResponse.json(
        { error: "Transcription not found" },
        { status: 404 },
      );
    }

    // Check if user owns this transcription
    if (transcription.userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Delete the transcription
    await prisma.transcription.delete({
      where: { id },
    });

    // Notify client of transcription deletion
    notifyDatabaseChange(user.id, "transcription", "delete", { id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting transcription:", error);
    return NextResponse.json(
      { error: "Failed to delete transcription" },
      { status: 500 },
    );
  }
}

export const pollPendingTranscriptions = async (
  transcription: Transcription,
): Promise<Transcription> => {
  if (
    transcription.state === "PENDING" &&
    transcription.elevenLabsTranscriptionId &&
    isElevenLabsConfigured()
  ) {
    try {
      const elevenLabs = getElevenLabsClient();
      const status = await elevenLabs.getTranscriptionStatus(
        transcription.elevenLabsTranscriptionId,
      );

      if (status.status === "completed" && status.transcription) {
        // Update the transcription with the result
        const updated = await prisma.transcription.update({
          where: { id: transcription.id },
          data: {
            state: "COMPLETED",
            transcription: status.transcription as never,
            completedAt: new Date(),
          },
        });

        // Notify client of transcription completion
        notifyDatabaseChange(transcription.userId, "transcription", "update", {
          id: updated.id,
        });

        return updated;
      } else if (status.status === "failed") {
        // Update with error
        const updated = await prisma.transcription.update({
          where: { id: transcription.id },
          data: {
            state: "ERROR",
            errorMessage: status.error || "Transcription failed",
          },
        });

        // Notify client of transcription error
        notifyDatabaseChange(transcription.userId, "transcription", "update", {
          id: updated.id,
        });

        return updated;
      }
      // If still processing, continue with original transcription data
    } catch (error) {
      console.error("Error checking transcription status:", error);
      // Continue with original transcription data
    }
  }

  return transcription;
};

export const mapTransactionDetails = (transcription: Transcription) =>
  _.pick(transcription, [
    "id",
    "title",
    "audioFileName",
    "audioFileSize",
    "audioFileKey",
    "language",
    "vocabulary",
    "speakerCount",
    "state",
    "errorMessage",
    "transcription",
    "projectId",
    "createdAt",
    "updatedAt",
    "completedAt",
  ]);
