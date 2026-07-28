import { Transcription } from "@prisma/client";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { notifyDatabaseChange } from "@/lib/sockets/socket-helpers";
import {
  EncryptedDataEntity,
  EncryptionUtils,
} from "@/lib/encryption/encryption-entities";
import { encodeSpeakerCache } from "@/lib/transcriptions/speakers";
import { TranscriptionResult, TranscriptionWord } from "./elevenlabs";
import { getConfig } from "@/lib/config";
import { sendEmail } from "@/lib/email/mailer";
import {
  getTranscriptionCompletedEmailTemplate,
  getTranscriptionFailedEmailTemplate,
} from "@/lib/email/email-templates-account";

// Replies to transcription emails should reach a human.
const SUPPORT_REPLY_TO = "romaric@humanlogs.app";

/** Map the STT provider to the model region surfaced to users (EU vs US). */
function modelRegionForProvider(sttProvider: string | null): "eu" | "us" {
  return sttProvider === "elevenlabs" ? "us" : "eu";
}

/** Derive the audio length (rounded minutes) from the transcription words. */
function durationMinutesFromResult(
  result: TranscriptionResult,
): number | undefined {
  let maxEnd = 0;
  const scan = (words?: TranscriptionWord[]) => {
    for (const w of words || []) {
      if (typeof w.end === "number" && w.end > maxEnd) maxEnd = w.end;
    }
  };
  scan(result.words);
  if (Array.isArray(result.transcripts)) {
    for (const channel of result.transcripts) scan(channel.words);
  }
  if (maxEnd <= 0) return undefined;
  return Math.max(1, Math.round(maxEnd / 60));
}

/**
 * Send a "transcription ready" email to the owner.
 * Best-effort: never throws so it cannot break the completion flow.
 */
async function sendTranscriptionCompletedEmail(
  transcription: Transcription,
  result: TranscriptionResult,
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: transcription.userId },
      select: { email: true, language: true },
    });

    if (!user?.email) {
      return;
    }

    const baseUrl = getConfig().server.publicUrl.replace(/\/$/, "");
    const template = await getTranscriptionCompletedEmailTemplate({
      transcriptionUrl: `${baseUrl}/app/transcription/${transcription.id}`,
      durationMinutes: durationMinutesFromResult(result),
      modelRegion: modelRegionForProvider(transcription.sttProvider),
      locale: user.language,
    });

    await sendEmail({
      to: user.email,
      replyTo: SUPPORT_REPLY_TO,
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
 * Send a "transcription failed" email to the owner.
 * Best-effort: never throws so it cannot break the failure flow.
 */
async function sendTranscriptionFailedEmail(
  transcription: Transcription,
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: transcription.userId },
      select: { email: true, language: true },
    });

    if (!user?.email) {
      return;
    }

    const baseUrl = getConfig().server.publicUrl.replace(/\/$/, "");
    const template = await getTranscriptionFailedEmailTemplate({
      transcriptionUrl: `${baseUrl}/app/transcription/${transcription.id}`,
      modelRegion: modelRegionForProvider(transcription.sttProvider),
      locale: user.language,
    });

    await sendEmail({
      to: user.email,
      replyTo: SUPPORT_REPLY_TO,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  } catch (error) {
    console.error(
      `Failed to send failure email for transcription ${transcription.id}:`,
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
  const utils = new EncryptionUtils(crypto);
  const encodedTranscription = await utils.encrypt(
    transcription.transcription as EncryptedDataEntity,
    result,
  );

  // The roster cache follows the content it summarizes, and is encrypted for
  // the same accessors — this is the one moment the server can read it.
  const speakers = await encodeSpeakerCache(
    result,
    transcription.transcription,
    utils,
  );

  // Update the transcription with the result
  const updated = await prisma.transcription.update({
    where: { id: transcription.id },
    data: {
      state: "COMPLETED",
      transcription: encodedTranscription as never,
      ...(speakers ? { speakers: speakers as never } : {}),
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
    await sendTranscriptionCompletedEmail(updated, result);
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

  // Avoid double emails when polling and the webhook both resolve the same job.
  const wasAlreadyFailed = transcription.state === "ERROR";

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

  // Let the owner know it failed (best-effort, only on the first failure).
  if (!wasAlreadyFailed) {
    await sendTranscriptionFailedEmail(updated);
  }

  return updated;
}
