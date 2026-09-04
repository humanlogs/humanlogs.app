import { captureError } from "@/lib/observability/sentry";
import { prisma } from "@/lib/prisma";
import type { TranscriptionResult } from "@/lib/stt/gladia";
import { getGladiaClient } from "@/lib/stt/gladia";
import {
  completeTranscription,
  failTranscription,
} from "@/lib/stt/transcription-completion";
import { NextRequest, NextResponse } from "next/server";

/**
 * Gladia Webhook Handler
 *
 * This endpoint receives webhook notifications from Gladia when a transcription job completes.
 * The webhook is configured in the Gladia request when starting a transcription.
 *
 * Webhook payload structure from Gladia:
 * {
 *   "id": "string",
 *   "event": "transcription.success" | "transcription.error",
 *   "payload": {
 *     "transcription": {
 *       "full_transcript": "string",
 *       "utterances": [...],
 *       "languages": [...]
 *     },
 *     "diarization": {
 *       "success": boolean,
 *       "results": [...]
 *     }
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    // Extract transcription ID — Gladia sends it inside payload.payload.id
    const gladiaTranscriptionId = payload.payload?.id ?? payload.id;
    if (!gladiaTranscriptionId) {
      console.error("No id in webhook payload:", JSON.stringify(payload));
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    if (!gladiaTranscriptionId.match(/^[a-zA-Z0-9_-]+$/)) {
      console.error(`Invalid transcription ID format`);
      return;
    }

    // Find the transcription in our database
    // We need to search with the "gladia-" prefix that we add
    const transcription = await prisma.transcription.findFirst({
      where: {
        elevenLabsTranscriptionId: `gladia-${gladiaTranscriptionId}`,
        state: "PENDING",
      },
    });

    if (!transcription) {
      console.error(
        `No pending transcription found for Gladia ID: ${gladiaTranscriptionId}`,
      );
      // Return 200 to acknowledge receipt even if we don't have the transcription
      // This prevents Gladia from retrying the webhook
      return NextResponse.json({
        received: true,
        warning: "Transcription not found",
      });
    }

    // Check event and process accordingly
    const event = String(payload.event || "").toLowerCase();

    // Intermediate lifecycle events — acknowledge and do nothing
    if (event === "transcription.created" || event === "transcription.processing") {
      return NextResponse.json({ received: true, status: event });
    }

    if (event === "transcription.success" && payload.payload?.transcription) {
      // Transcription completed successfully
      console.log(`Transcription ${transcription.id} completed via webhook`);

      // Map Gladia's response to our TranscriptionResult format
      const transcriptionResult = mapGladiaToTranscriptionResult(payload);

      // Use the common function to complete the transcription
      await completeTranscription(
        transcription.id,
        transcriptionResult,
        transcription,
      );

      // Delete the transcription from Gladia to ensure no data is retained
      try {
        const client = getGladiaClient();
        await client.deleteTranscription(`gladia-${gladiaTranscriptionId}`);
      } catch (error) {
        console.error(
          `Error deleting transcription ${gladiaTranscriptionId} from Gladia:`,
          error,
        );
        // Don't fail the webhook if deletion fails
      }

      return NextResponse.json({ received: true, status: "completed" });
    } else if (
      event === "transcription.error" ||
      event === "transcription.failed"
    ) {
      // Transcription failed
      console.error(
        `Transcription ${transcription.id} failed via webhook:`,
        payload.payload?.error,
      );

      // Use the common function to mark as failed
      await failTranscription(
        transcription.id,
        `Transcription failed: ${payload.payload?.error || "unknown error"}`,
        transcription,
      );

      // Delete the failed transcription from Gladia
      try {
        const client = getGladiaClient();
        await client.deleteTranscription(`gladia-${gladiaTranscriptionId}`);
      } catch (error) {
        console.error(
          `Error deleting failed transcription ${gladiaTranscriptionId} from Gladia:`,
          error,
        );
        // Don't fail the webhook if deletion fails
      }

      return NextResponse.json({ received: true, status: "failed" });
    } else {
      // Unknown event or incomplete data
      console.warn(
        `Unexpected webhook event for transcription ${transcription.id}:`,
        event,
        JSON.stringify(payload),
      );
      return NextResponse.json({
        received: true,
        warning: "Unexpected event",
      });
    }
  } catch (error) {
    console.error("Error processing Gladia webhook:", error);
    captureError(error, {
      stage: "webhook",
      job: "gladia",
      sttProvider: "gladia",
      httpStatus: 500,
    });
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}

/**
 * Map Gladia's response format to our TranscriptionResult format
 */
function mapGladiaToTranscriptionResult(payload: any): TranscriptionResult {
  const transcription = payload.payload?.transcription;

  if (!transcription) {
    throw new Error("No transcription data in payload");
  }

  console.log("Mapping Gladia payload to TranscriptionResult");

  // Extract words from utterances (speaker info is already in utterances)
  const words: Array<{
    text: string;
    start: number;
    end: number;
    type?: string;
    speakerId?: string;
  }> = [];

  const speakerMap = new Map<number, string>();

  // Use transcription utterances (has speaker info)
  const sourceData = transcription.utterances || [];

  if (Array.isArray(sourceData)) {
    for (const utterance of sourceData) {
      // Gladia uses 0-based speaker numbering
      // We keep it 0-based but format as "speaker_0", "speaker_1", etc.
      const speakerId =
        utterance.speaker !== undefined && utterance.speaker !== null
          ? `speaker_${utterance.speaker}`
          : undefined;

      if (speakerId && utterance.speaker !== undefined) {
        speakerMap.set(utterance.speaker, speakerId);
      }

      if (utterance.words && Array.isArray(utterance.words)) {
        for (const word of utterance.words) {
          words.push({
            text: word.word || "",
            start: word.start || 0,
            end: word.end || 0,
            type: "word",
            speakerId: speakerId,
          });
        }
      }
    }
  }

  // Extract language
  const languageCode =
    transcription.languages && transcription.languages.length > 0
      ? transcription.languages[0]
      : undefined;

  // Build the result
  const result: TranscriptionResult = {
    text: transcription.full_transcript || "",
    words,
    language_code: languageCode,
  };

  return result;
}
