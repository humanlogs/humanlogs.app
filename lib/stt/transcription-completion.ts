import { Transcription } from "@prisma/client";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { notifyDatabaseChange } from "@/lib/sockets/socket-helpers";
import {
  EncryptedDataEntity,
  EncryptionUtils,
} from "@/lib/encryption/encryption-entities";
import { TranscriptionResult } from "./elevenlabs";

/**
 * Common function to complete a transcription with the result from ElevenLabs
 * Can be called from both polling (getTranscriptionStatus) and webhook
 */
export async function completeTranscription(
  transcriptionId: string,
  result: TranscriptionResult,
  existingTranscription?: Transcription,
): Promise<Transcription> {
  // Fetch transcription if not provided
  const transcription =
    existingTranscription ||
    (await prisma.transcription.findUnique({
      where: { id: transcriptionId },
    }));

  if (!transcription) {
    throw new Error(`Transcription ${transcriptionId} not found`);
  }

  // If the transcription is an EncryptedDataEntity, encrypt the result with the transcription's public key
  const encodedTranscription = await new EncryptionUtils(crypto).encrypt(
    transcription.transcription as EncryptedDataEntity,
    result,
  );

  // Update the transcription with the result
  const updated = await prisma.transcription.update({
    where: { id: transcription.id },
    data: {
      state: "COMPLETED",
      transcription: encodedTranscription as never,
      completedAt: new Date(),
    },
  });

  // Notify client of transcription completion
  notifyDatabaseChange(transcription.userId, "transcription", "update", {
    id: updated.id,
  });

  return updated;
}

/**
 * Common function to mark a transcription as failed
 * Can be called from both polling (getTranscriptionStatus) and webhook
 */
export async function failTranscription(
  transcriptionId: string,
  error: string,
  existingTranscription?: Transcription,
): Promise<Transcription> {
  // Fetch transcription if not provided
  const transcription =
    existingTranscription ||
    (await prisma.transcription.findUnique({
      where: { id: transcriptionId },
    }));

  if (!transcription) {
    throw new Error(`Transcription ${transcriptionId} not found`);
  }

  // Update with error
  const updated = await prisma.transcription.update({
    where: { id: transcription.id },
    data: {
      state: "ERROR",
      errorMessage: error || "Transcription failed",
    },
  });

  // Notify client of transcription error
  notifyDatabaseChange(transcription.userId, "transcription", "update", {
    id: updated.id,
  });

  return updated;
}
