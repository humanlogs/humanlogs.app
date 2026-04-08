import { getSTTService } from "@/lib/stt-service";
import { prisma } from "@/lib/prisma";
import { Transcription } from "@prisma/client";
import { NextResponse } from "next/server";
import { EncryptedDataEntity } from "../../../lib/encryption-entities";
import { pollPendingTranscriptions } from "./[id]/route";
import { withAuthRateLimit } from "@/lib/rate-limit-middleware";

export const GET = withAuthRateLimit(async (request, user) => {
  try {
    // Fetch transcriptions owned by the user and transcriptions shared with the user
    // We use raw SQL for the shared transcriptions because Prisma doesn't have great JSONB array querying
    const [ownedTranscriptions, sharedTranscriptions] = await Promise.all([
      // Transcriptions owned by the user
      prisma.transcription.findMany({
        where: {
          userId: user.id,
        },
        orderBy: {
          updatedAt: "desc",
        },
        take: 1000,
      }),
      // Transcriptions shared with the user
      prisma.$queryRaw<Transcription[]>`
        SELECT * FROM "Transcription"
        WHERE "shared" IS NOT NULL
          AND "shared"::jsonb @> ${JSON.stringify([{ userId: user.id }])}::jsonb
        ORDER BY "updatedAt" DESC
        LIMIT 1000
      `,
    ]);

    // Combine and deduplicate (in case a transcription is both owned and shared)
    const transcriptionsMap = new Map<string, Transcription>();
    [...ownedTranscriptions, ...sharedTranscriptions].forEach((t) => {
      transcriptionsMap.set(t.id, t);
    });

    const transcriptions = Array.from(transcriptionsMap.values()).sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    );

    // Check status for PENDING transcriptions with STT service
    const stt = getSTTService();
    if (stt.isConfigured()) {
      const statusChecks = transcriptions
        .filter((t) => t.state === "PENDING" && t.elevenLabsTranscriptionId)
        .map(async (t) => {
          return await pollPendingTranscriptions(t);
        });

      // Wait for all status checks to complete
      if (statusChecks.length > 0) {
        await Promise.all(statusChecks);

        // Re-fetch transcriptions to get updated data
        const [updatedOwned, updatedShared] = await Promise.all([
          prisma.transcription.findMany({
            where: {
              userId: user.id,
            },
            orderBy: {
              updatedAt: "desc",
            },
            take: 1000,
          }),
          prisma.$queryRaw<Transcription[]>`
            SELECT * FROM "Transcription"
            WHERE "shared" IS NOT NULL
              AND "shared"::jsonb @> ${JSON.stringify([{ userId: user.id }])}::jsonb
            ORDER BY "updatedAt" DESC
            LIMIT 1000
          `,
        ]);

        // Combine and deduplicate
        const updatedMap = new Map<string, Transcription>();
        [...updatedOwned, ...updatedShared].forEach((t) => {
          updatedMap.set(t.id, t);
        });

        const updatedTranscriptions = Array.from(updatedMap.values()).sort(
          (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
        );

        // Transform to match the frontend format
        const formattedTranscriptions = updatedTranscriptions.map((t) =>
          formatTranscriptionList(t, user.id),
        );

        return NextResponse.json(formattedTranscriptions);
      }
    }

    // Transform to match the frontend format
    const formattedTranscriptions = transcriptions.map((t) =>
      formatTranscriptionList(t, user.id),
    );

    return NextResponse.json(formattedTranscriptions);
  } catch (error) {
    console.error("Error fetching transcriptions:", error);
    return NextResponse.json(
      { error: "Failed to fetch transcriptions" },
      { status: 500 },
    );
  }
});

const formatTranscriptionList = (t: Transcription, userId: string) => {
  type SharedUser = { userId: string; role: string };
  const shared = (t.shared as SharedUser[]) || [];
  const isOwner = t.userId === userId;
  const sharedUser = shared.find((s) => s.userId === userId);

  return {
    id: t.id,
    title: t.title,
    audioFileName: t.audioFileName,
    updatedAt: t.updatedAt.toISOString(),
    projectId: t.projectId,
    state: t.state,
    errorMessage: t.errorMessage,
    isEncrypted: (t.audioFileEncryption as EncryptedDataEntity)?.privateKeys
      ? true
      : false,
    isOwner,
    role: isOwner ? "owner" : sharedUser?.role || null,
    shared: shared,
  };
};
