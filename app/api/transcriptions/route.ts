import { getSTTService } from "@/lib/stt/stt-service";
import { prisma } from "@/lib/prisma";
import { Transcription } from "@prisma/client";
import { NextResponse } from "next/server";
import { EncryptedDataEntity } from "../../../lib/encryption/encryption-entities";
import { pollPendingTranscriptions } from "./[id]/route";
import { withAuthRateLimit } from "@/lib/router/rate-limit-middleware";
import { findTranscriptionsSharedWith } from "@/lib/transcriptions/access";
import { formatProject, type ProjectDTO } from "@/lib/projects/format";
import { parseCodeRefs, parseSpeakerCodeRefs } from "@/lib/codebooks/codebook";
import {
  parseSpeakers,
  readSpeakerCache,
  type SpeakerCache,
} from "@/lib/transcriptions/speakers";

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
      findTranscriptionsSharedWith(user.id),
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
          findTranscriptionsSharedWith(user.id),
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
        const updatedStudies = await studiesOf(updatedTranscriptions);
        const formattedTranscriptions = updatedTranscriptions.map((t) =>
          formatTranscriptionList(t, user.id, updatedStudies),
        );

        return NextResponse.json(formattedTranscriptions);
      }
    }

    // Transform to match the frontend format
    const studies = await studiesOf(transcriptions);
    const formattedTranscriptions = transcriptions.map((t) =>
      formatTranscriptionList(t, user.id, studies),
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

/**
 * The studies of a set of documents, by id.
 *
 * Looked up from the DOCUMENTS rather than from the caller's own studies: a
 * document received through a share belongs to somebody else's study, and the
 * sidebar has to name it — a shared interview with no study reads as loose
 * material, which is precisely what it is not. Only studies reachable from a
 * document the caller can already open are ever returned.
 */
async function studiesOf(
  transcriptions: Transcription[],
): Promise<Map<string, ProjectDTO>> {
  const ids = Array.from(
    new Set(
      transcriptions
        .map((t) => t.projectId)
        .filter((id): id is string => typeof id === "string"),
    ),
  );
  if (ids.length === 0) return new Map();
  const projects = await prisma.project.findMany({ where: { id: { in: ids } } });
  return new Map(projects.map((p) => [p.id, formatProject(p)]));
}

const formatTranscriptionList = (
  t: Transcription,
  userId: string,
  studies: Map<string, ProjectDTO>,
) => {
  type SharedUser = { userId: string; role: string };
  const shared = (t.shared as SharedUser[]) || [];
  const isOwner = t.userId === userId;
  const sharedUser = shared.find((s) => s.userId === userId);

  // The roster comes from its own column rather than from the (possibly large,
  // possibly encrypted) content: that is what the cache is for. It travels as
  // stored — an EncryptedDataEntity for an E2E document, which the client
  // decrypts on its own, cheaply. Falling back to the content covers a document
  // whose cache was never written.
  const speakers =
    (t.speakers as SpeakerCache | null) ?? parseSpeakers(t.transcription);
  const readable = readSpeakerCache(speakers);
  const speakerNames = readable?.map((s) => s.name);

  return {
    id: t.id,
    title: t.title,
    audioFileName: t.audioFileName,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    isTutorial: t.isTutorial,
    projectId: t.projectId,
    // The study itself, not just its id: the sidebar groups and labels by it, and
    // for a shared document the client has no other way to resolve it.
    study: t.projectId ? (studies.get(t.projectId) ?? null) : null,
    speakerCount: t.speakerCount,
    speakerNames,
    speakers,
    mediaType: t.mediaType,
    // Opaque { codebookId, codeId } refs; the sidebar groups on them.
    codes: parseCodeRefs(t.codes),
    // Same, pinned on a speaker of the document — a speaker codebook groups the
    // list on both.
    speakerCodes: parseSpeakerCodeRefs(t.speakerCodes),
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
