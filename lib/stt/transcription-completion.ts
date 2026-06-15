import { Transcription } from "@prisma/client";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { notifyDatabaseChange } from "@/lib/sockets/socket-helpers";
import {
  EncryptedDataEntity,
  EncryptionUtils,
} from "@/lib/encryption/encryption-entities";
import { TranscriptionResult } from "./elevenlabs";
import { getConfig } from "@/lib/config";
import { sendEmail } from "@/lib/email/mailer";
import { getTranscriptionCompletedEmailTemplate } from "@/lib/email/email-templates-account";

/**
 * Send a "transcription ready" email to the owner.
 * Best-effort: never throws so it cannot break the completion flow.
 */
async function sendTranscriptionCompletedEmail(
  transcription: Transcription,
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: transcription.userId },
      select: { email: true, name: true },
    });

    if (!user?.email) {
      return;
    }

    const baseUrl = getConfig().server.publicUrl.replace(/\/$/, "");
    const fileName =
      transcription.title || transcription.audioFileName || "your audio file";

    const template = getTranscriptionCompletedEmailTemplate({
      userName: user.name || user.email,
      fileName,
      transcriptionUrl: `${baseUrl}/app/transcription/${transcription.id}`,
    });

    await sendEmail({
      to: user.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  } catch (error) {
    console.error(
      `Failed to send completion email for transcription ${transcription.id}:`,
      error,
    );
  }
}

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

  // Whether the transcription was already completed before (avoid double emails
  // when both polling and the webhook resolve the same job).
  const wasAlreadyCompleted = transcription.state === "COMPLETED";

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

  // Notify the owner by email (transcriptions can take a while, so the user may
  // have closed the page). Best-effort and only on the first completion.
  if (!wasAlreadyCompleted) {
    await sendTranscriptionCompletedEmail(updated);
  }

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
