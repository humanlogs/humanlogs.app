import { requireAuth } from "@/lib/auth-helpers";
import { isElevenLabsConfigured } from "@/lib/elevenlabs";
import { prisma } from "@/lib/prisma";
import { Transcription } from "@prisma/client";
import { NextResponse } from "next/server";
import { pollPendingTranscriptions } from "./[id]/route";

export async function GET() {
  try {
    const user = await requireAuth();

    // Fetch all transcriptions for the user (up to 1000)
    const transcriptions = await prisma.transcription.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 1000,
    });

    // Check status for PENDING transcriptions with ElevenLabs
    if (isElevenLabsConfigured()) {
      const statusChecks = transcriptions
        .filter((t) => t.state === "PENDING" && t.elevenLabsTranscriptionId)
        .map(async (t) => {
          return await pollPendingTranscriptions(t);
        });

      // Wait for all status checks to complete
      if (statusChecks.length > 0) {
        await Promise.all(statusChecks);

        // Re-fetch transcriptions to get updated data
        const updatedTranscriptions = await prisma.transcription.findMany({
          where: {
            userId: user.id,
          },
          orderBy: {
            updatedAt: "desc",
          },
          take: 1000,
        });

        // Transform to match the frontend format
        const formattedTranscriptions = updatedTranscriptions.map(
          formatTranscriptionList,
        );

        return NextResponse.json(formattedTranscriptions);
      }
    }

    // Transform to match the frontend format
    const formattedTranscriptions = transcriptions.map(formatTranscriptionList);

    return NextResponse.json(formattedTranscriptions);
  } catch (error) {
    console.error("Error fetching transcriptions:", error);
    return NextResponse.json(
      { error: "Failed to fetch transcriptions" },
      { status: 500 },
    );
  }
}

const formatTranscriptionList = (t: Transcription) => {
  return {
    id: t.id,
    title: t.title,
    audioFileName: t.audioFileName,
    updatedAt: t.updatedAt.toISOString(),
    projectId: t.projectId,
    state: t.state,
    errorMessage: t.errorMessage,
  };
};
