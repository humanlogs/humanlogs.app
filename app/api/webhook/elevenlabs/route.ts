import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  completeTranscription,
  failTranscription,
} from "@/lib/stt/transcription-completion";
import { getElevenLabsClient } from "@/lib/stt/elevenlabs";

/**
 * ElevenLabs Webhook Handler
 *
 * This endpoint receives webhook notifications from ElevenLabs when a transcription job completes.
 * The webhook is configured in the ElevenLabs client when starting a transcription.
 *
 * Webhook payload structure from ElevenLabs:
 * {
 *   "transcription_id": "string",
 *   "status": "completed" | "failed" | "error",
 *   "text": "string",
 *   "words": [...],
 *   "error": "string" (optional, present if status is failed/error)
 *   ... (additional fields preserved)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    console.log("Received ElevenLabs webhook:", {
      transcriptionId: payload.transcription_id,
      status: payload.status,
    });

    // Extract transcription ID
    const elevenLabsTranscriptionId = payload.transcription_id;
    if (!elevenLabsTranscriptionId) {
      console.error("No transcription_id in webhook payload");
      return NextResponse.json(
        { error: "Missing transcription_id" },
        { status: 400 },
      );
    }

    if (!elevenLabsTranscriptionId.match(/^[a-zA-Z0-9_-]+$/)) {
      console.error(`Invalid transcription ID format`);
      return;
    }

    // Find the transcription in our database
    const transcription = await prisma.transcription.findFirst({
      where: {
        elevenLabsTranscriptionId,
        state: "PENDING",
      },
    });

    if (!transcription) {
      console.error(
        `No pending transcription found for ElevenLabs ID: ${elevenLabsTranscriptionId}`,
      );
      // Return 200 to acknowledge receipt even if we don't have the transcription
      // This prevents ElevenLabs from retrying the webhook
      return NextResponse.json({
        received: true,
        warning: "Transcription not found",
      });
    }

    // Check status and process accordingly
    const status = String(payload.status || "").toLowerCase();

    if (status === "completed" && payload.text && payload.words) {
      // Transcription completed successfully
      console.log(`Transcription ${transcription.id} completed via webhook`);

      // The payload from ElevenLabs contains the full transcription result
      // Map it to our TranscriptionResult format
      const transcriptionResult = {
        text: payload.text,
        words: payload.words || [],
        speakers: payload.speakers,
        language_code: payload.language_code,
        transcripts: payload.transcripts,
        ...payload, // Preserve all additional fields
      };

      // Use the common function to complete the transcription
      await completeTranscription(
        transcription.id,
        transcriptionResult,
        transcription,
      );

      // Delete the transcription from ElevenLabs to ensure no data is retained
      try {
        const client = getElevenLabsClient();
        await client.deleteTranscription(elevenLabsTranscriptionId);
      } catch (error) {
        console.error(
          `Error deleting transcription ${elevenLabsTranscriptionId} from ElevenLabs:`,
          error,
        );
        // Don't fail the webhook if deletion fails
      }

      return NextResponse.json({ received: true, status: "completed" });
    } else if (status === "failed" || status === "error") {
      // Transcription failed
      console.error(
        `Transcription ${transcription.id} failed via webhook:`,
        payload.error,
      );

      // Use the common function to mark as failed
      await failTranscription(
        transcription.id,
        payload.error || "Transcription failed",
        transcription,
      );

      // Delete the failed transcription from ElevenLabs
      try {
        const client = getElevenLabsClient();
        await client.deleteTranscription(elevenLabsTranscriptionId);
      } catch (error) {
        console.error(
          `Error deleting failed transcription ${elevenLabsTranscriptionId} from ElevenLabs:`,
          error,
        );
        // Don't fail the webhook if deletion fails
      }

      return NextResponse.json({ received: true, status: "failed" });
    } else {
      // Unknown status or incomplete data
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
    console.error("Error processing ElevenLabs webhook:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
