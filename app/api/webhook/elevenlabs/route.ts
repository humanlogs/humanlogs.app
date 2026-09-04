import { captureError } from "@/lib/observability/sentry";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  completeTranscription,
  failTranscription,
} from "@/lib/stt/transcription-completion";
import { getElevenLabsClient } from "@/lib/stt/elevenlabs";
import { sttConfig } from "@/lib/config";
import {
  sendAdminError,
  sendWebhookProcessingError,
  sendAdminWarning,
} from "@/lib/email/error-notifications";
import crypto from "crypto";

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

/**
 * Verify webhook signature using HMAC-SHA256
 */
function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature || !secret) {
    return false;
  }

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest("hex");

  // Use timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature),
  );
}

export async function POST(request: NextRequest) {
  try {
    // Read the raw body for signature verification
    const rawBody = await request.text();
    const payload = JSON.parse(rawBody);

    // Verify webhook signature if secret is configured
    const webhookSecret = sttConfig.elevenlabs.webhookSecret;
    if (webhookSecret) {
      const signature = request.headers.get("x-elevenlabs-signature");

      if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
        console.error("Invalid webhook signature");

        // Send warning about potential security issue
        await sendAdminWarning(
          "Invalid webhook signature - potential security issue or misconfiguration",
          {
            transcriptionId: payload.transcription_id || "unknown",
            receivedSignature: signature || "none",
            ipAddress:
              request.headers.get("x-forwarded-for") ||
              request.headers.get("x-real-ip") ||
              "unknown",
          },
        );

        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 },
        );
      }
    }

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

      // Send warning about sync issue
      await sendAdminWarning(
        "Webhook received for transcription not found in database - possible sync issue",
        {
          elevenLabsTranscriptionId,
          status: payload.status,
          webhookTimestamp: new Date().toISOString(),
        },
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

        // Send warning about data retention issue
        await sendAdminWarning(
          "Failed to delete transcription data from ElevenLabs - data retention concern",
          {
            transcriptionId: transcription.id,
            elevenLabsTranscriptionId,
            errorMessage:
              error instanceof Error ? error.message : String(error),
          },
        );
        // Don't fail the webhook if deletion fails
      }

      return NextResponse.json({ received: true, status: "completed" });
    } else if (status === "failed" || status === "error") {
      // Transcription failed
      const errorMessage = payload.error || "Transcription failed";

      console.error(
        `Transcription ${transcription.id} failed via webhook:`,
        errorMessage,
      );

      // Check if it's a quota exceeded error
      const isQuotaExceeded =
        errorMessage.toLowerCase().includes("quota") ||
        errorMessage.toLowerCase().includes("limit exceeded") ||
        payload.error_code === "quota_exceeded";

      // Send email notification for errors and quota issues
      await sendAdminError({
        error: isQuotaExceeded ? "Quota Exceeded" : errorMessage,
        context: {
          transcriptionId: transcription.id,
          status: payload.status || "N/A",
          errorCode: payload.error_code,
          payload,
        },
      });

      // Use the common function to mark as failed
      await failTranscription(transcription.id, errorMessage, transcription);

      // Delete the failed transcription from ElevenLabs
      try {
        const client = getElevenLabsClient();
        await client.deleteTranscription(elevenLabsTranscriptionId);
      } catch (error) {
        console.error(
          `Error deleting failed transcription ${elevenLabsTranscriptionId} from ElevenLabs:`,
          error,
        );

        // Send warning about data retention issue
        await sendAdminWarning(
          "Failed to delete failed transcription data from ElevenLabs - data retention concern",
          {
            transcriptionId: transcription.id,
            elevenLabsTranscriptionId,
            errorMessage:
              error instanceof Error ? error.message : String(error),
          },
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

      // Send warning about unexpected status
      await sendAdminWarning(
        "Received webhook with unexpected status - possible API change",
        {
          transcriptionId: transcription.id,
          elevenLabsTranscriptionId,
          status: payload.status,
          hasText: !!payload.text,
          hasWords: !!payload.words,
          payload,
        },
      );

      return NextResponse.json({
        received: true,
        warning: "Unexpected status",
      });
    }
  } catch (error) {
    console.error("Error processing ElevenLabs webhook:", error);
    captureError(error, {
      stage: "webhook",
      job: "elevenlabs",
      sttProvider: "elevenlabs",
      httpStatus: 500,
    });

    // Send email notification for processing errors
    await sendWebhookProcessingError(
      error instanceof Error ? error : String(error),
    );

    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
