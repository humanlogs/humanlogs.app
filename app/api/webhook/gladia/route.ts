import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  completeTranscription,
  failTranscription,
} from "@/lib/stt/transcription-completion";
import { getGladiaClient } from "@/lib/stt/gladia";
import type { TranscriptionResult } from "@/lib/stt/gladia";

/**
 * Gladia Webhook Handler
 *
 * This endpoint receives webhook notifications from Gladia when a transcription job completes.
 * The webhook is configured in the Gladia request when starting a transcription.
 *
 * Webhook payload structure from Gladia:
 * {
 *   "id": "string",
 *   "status": "queued" | "done" | "error" | "failed",
 *   "result": {
 *     "transcription": {
 *       "full_transcript": "string",
 *       "utterances": [...],
 *       "languages": [...]
 *     }
 *   },
 *   "error_code": number (optional)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    console.log("Received Gladia webhook:", {
      id: payload.id,
      status: payload.status,
    });

    // Extract transcription ID
    const gladiaTranscriptionId = payload.id;
    if (!gladiaTranscriptionId) {
      console.error("No id in webhook payload");
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
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

    // Check status and process accordingly
    const status = String(payload.status || "").toLowerCase();

    if (status === "done" && payload.result?.transcription) {
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
    } else if (status === "error" || status === "failed") {
      // Transcription failed
      console.error(
        `Transcription ${transcription.id} failed via webhook:`,
        payload.error_code,
      );

      // Use the common function to mark as failed
      await failTranscription(
        transcription.id,
        `Transcription failed with error code: ${payload.error_code || "unknown"}`,
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
      // Unknown status or incomplete data (queued, etc.)
      console.warn(
        `Unexpected webhook status for transcription ${transcription.id}:`,
        status,
      );
      return NextResponse.json({
        received: true,
        warning: "Unexpected status",
      });
    }
  } catch (error) {
    console.error("Error processing Gladia webhook:", error);
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
  const transcription = payload.result?.transcription;

  if (!transcription) {
    throw new Error("No transcription data in payload");
  }

  // Extract words from utterances
  const words: Array<{
    text: string;
    start: number;
    end: number;
    type?: string;
    speaker_id?: string;
  }> = [];

  const speakerSet = new Set<string>();

  if (transcription.utterances && Array.isArray(transcription.utterances)) {
    for (const utterance of transcription.utterances) {
      const speakerId = utterance.speaker
        ? `Speaker ${utterance.speaker}`
        : undefined;

      if (speakerId) {
        speakerSet.add(speakerId);
      }

      if (utterance.words && Array.isArray(utterance.words)) {
        for (const word of utterance.words) {
          words.push({
            text: word.word || "",
            start: word.start || 0,
            end: word.end || 0,
            type: "word",
            speaker_id: speakerId,
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
    speakers: speakerSet.size > 0 ? Array.from(speakerSet) : undefined,
    language_code: languageCode,
  };

  return result;
}
