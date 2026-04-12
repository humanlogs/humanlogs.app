import { ElevenLabsClient as ElevenLabsSDK } from "@elevenlabs/elevenlabs-js";
import { getConfig } from "../config";

export interface TranscriptionWord {
  text: string;
  start: number;
  end: number;
  type?: string; // word, spacing, audio_event, etc.
  speaker_id?: string;
  [key: string]: unknown; // Preserve any additional fields from ElevenLabs
}

export interface TranscriptionChannel {
  text: string;
  words: TranscriptionWord[];
  language_code?: string;
  [key: string]: unknown; // Preserve any additional fields
}

export interface TranscriptionResult {
  text: string;
  words: TranscriptionWord[];
  speakers?: string[];
  language_code?: string;
  transcripts?: TranscriptionChannel[]; // For multichannel responses
  [key: string]: unknown; // Preserve any additional fields from ElevenLabs
}

export interface TranscriptionRequest {
  audioUrl: string;
  language?: string;
  speakerCount?: number;
  vocabulary?: string[];
}

export interface TranscriptionFileRequest {
  fileBuffer: Buffer;
  fileName: string;
  language?: string;
  speakerCount?: number;
  vocabulary?: string[];
}

export interface AsyncTranscriptionResponse {
  transcriptionId: string;
  message: string;
}

export interface TranscriptionStatus {
  status: "pending" | "processing" | "completed" | "failed";
  transcription?: TranscriptionResult;
  error?: string;
}

class ElevenLabsClient {
  private client: ElevenLabsSDK;

  constructor() {
    const config = getConfig();
    this.client = new ElevenLabsSDK({
      apiKey: config.stt.elevenlabs.apiKey,
    });
  }

  /**
   * Build common transcription parameters
   */
  private buildTranscriptionParams(
    request: TranscriptionRequest | TranscriptionFileRequest,
  ) {
    return {
      // Store nothing
      enableLogging: getConfig().stt.elevenlabs?.canDisableStorage
        ? false
        : true,

      modelId: "scribe_v2" as const,
      tagAudioEvents: true,
      webhook: true, // Enable async processing
      languageCode: request.language || undefined,
      numSpeakers: request.speakerCount || undefined,
      diarize: request.speakerCount ? request.speakerCount > 1 : false,
      timestampsGranularity: "word" as const,
      keyterms:
        request.vocabulary && request.vocabulary.length > 0
          ? request.vocabulary
          : undefined,
    };
  }

  /**
   * Extract transcription ID from response
   */
  private extractTranscriptionId(
    response: unknown,
  ): AsyncTranscriptionResponse {
    const result = response as Record<string, unknown>;

    if (!("transcriptionId" in result) || !result.transcriptionId) {
      throw new Error("Transcription ID not returned from async request");
    }

    return {
      transcriptionId: String(result.transcriptionId),
      message: String(result.message || "Transcription started"),
    };
  }

  /**
   * Start an async transcription job from a file
   * Returns a transcription ID that can be used to check status later
   */
  async transcribeFromFileAsync(
    request: TranscriptionFileRequest,
  ): Promise<AsyncTranscriptionResponse> {
    try {
      // Create a File-like object from the buffer
      const uint8Array = new Uint8Array(request.fileBuffer);
      const file = new File([uint8Array], request.fileName, {
        type: "audio/mpeg",
      });

      const response = await this.client.speechToText.convert({
        ...this.buildTranscriptionParams(request),
        file,
      });

      return this.extractTranscriptionId(response);
    } catch (error) {
      console.error("Error starting async transcription:", error);
      throw error;
    }
  }

  /**
   * Start an async transcription job from a URL
   * Returns a transcription ID that can be used to check status later
   */
  async transcribeFromUrlAsync(
    request: TranscriptionRequest,
  ): Promise<AsyncTranscriptionResponse> {
    try {
      const response = await this.client.speechToText.convert({
        ...this.buildTranscriptionParams(request),
        cloudStorageUrl: request.audioUrl,
      });

      return this.extractTranscriptionId(response);
    } catch (error) {
      console.error("Error starting async transcription:", error);
      throw error;
    }
  }

  /**
   * Get the status and result of an async transcription
   * Automatically deletes the transcription from ElevenLabs once completed or failed
   * to ensure no data is retained on their servers
   */
  async getTranscriptionStatus(
    transcriptionId: string,
  ): Promise<TranscriptionStatus> {
    try {
      const response =
        await this.client.speechToText.transcripts.get(transcriptionId);

      // Cast to unknown first
      const result = response as unknown as Record<string, unknown>;

      // Check if transcription is completed
      if ("text" in result && "words" in result) {
        // Transcription is completed, preserve the full response
        const transcriptionResult = this.mapResponse(result);

        // Delete from ElevenLabs immediately after retrieving
        // This ensures data is not retained on their servers
        await this.deleteTranscription(transcriptionId);

        return {
          status: "completed",
          transcription: transcriptionResult,
        };
      }

      // Check for error status
      if ("status" in result) {
        const status = String(result.status).toLowerCase();
        if (status === "failed" || status === "error") {
          // Delete failed transcription from ElevenLabs
          await this.deleteTranscription(transcriptionId);

          return {
            status: "failed",
            error: result.error ? String(result.error) : "Transcription failed",
          };
        }
        if (status === "processing" || status === "transcribing") {
          return { status: "processing" };
        }
        if (status === "pending") {
          return { status: "pending" };
        }
      }

      // Default to processing if status unclear
      return { status: "processing" };
    } catch (error) {
      console.error("Error getting transcription status:", error);
      // If the transcription is not found, it might still be pending
      if (error instanceof Error && error.message.includes("404")) {
        return { status: "pending" };
      }
      throw error;
    }
  }

  /**
   * Map ElevenLabs response to our format, preserving all data
   */
  private mapResponse(response: Record<string, unknown>): TranscriptionResult {
    const responseWords =
      (response.words as Array<Record<string, unknown>>) || [];

    // Preserve all word data from ElevenLabs
    const words: TranscriptionWord[] = responseWords.map((w) => ({
      text: String(w.text || ""),
      start: Number(w.start || 0),
      end: Number(w.end || 0),
      type: w.type ? String(w.type) : undefined,
      speaker_id: w.speaker_id ? String(w.speaker_id) : undefined,
      ...w, // Preserve all additional fields
    }));

    // Extract unique speakers from words
    const speakerIds = new Set(
      words
        .map((w) => w.speaker_id)
        .filter((s): s is string => s !== undefined),
    );

    // Build result preserving all ElevenLabs fields
    const result: TranscriptionResult = {
      text: String(response.text || ""),
      words,
      speakers: speakerIds.size > 0 ? Array.from(speakerIds) : undefined,
      language_code: response.language_code
        ? String(response.language_code)
        : undefined,
      ...response, // Preserve all additional fields from ElevenLabs
    };

    // Handle multichannel transcripts if present
    if ("transcripts" in response && Array.isArray(response.transcripts)) {
      const transcripts = response.transcripts as Array<
        Record<string, unknown>
      >;
      result.transcripts = transcripts.map((transcript) => ({
        text: String(transcript.text || ""),
        words: ((transcript.words as Array<Record<string, unknown>>) || []).map(
          (w) => ({
            text: String(w.text || ""),
            start: Number(w.start || 0),
            end: Number(w.end || 0),
            type: w.type ? String(w.type) : undefined,
            speaker_id: w.speaker_id ? String(w.speaker_id) : undefined,
            ...w,
          }),
        ),
        language_code: transcript.language_code
          ? String(transcript.language_code)
          : undefined,
        ...transcript,
      }));
    }

    return result;
  }

  /**
   * Delete a transcription from ElevenLabs servers
   * This should be called after successfully retrieving the transcription
   * to ensure data is not stored on their servers
   */
  async deleteTranscription(transcriptionId: string): Promise<void> {
    try {
      await this.client.speechToText.transcripts.delete(transcriptionId);
      console.log(
        `Successfully deleted transcription ${transcriptionId} from ElevenLabs`,
      );
    } catch (error) {
      console.error(
        `Error deleting transcription ${transcriptionId} from ElevenLabs:`,
        error,
      );
      // Don't throw - deletion failure shouldn't break the app
      // The transcription was already retrieved successfully
    }
  }

  /**
   * Simulate transcription for development (when ElevenLabs is not configured)
   */
  async simulateTranscription(
    request: TranscriptionRequest,
    durationMinutes: number,
  ): Promise<TranscriptionResult> {
    // Simulate processing time (1 second per minute of audio, max 5 seconds)
    const processingTime = Math.min(durationMinutes * 1000, 5000);
    await new Promise((resolve) => setTimeout(resolve, processingTime));

    // Generate mock transcription
    const mockText = `This is a simulated transcription for development. 
The audio was ${durationMinutes} minutes long and was set to ${request.language || "auto"} language 
with ${request.speakerCount || 1} speaker(s).`;

    const words: TranscriptionWord[] = mockText
      .split(" ")
      .map((word, index) => ({
        text: word,
        start: index * 0.5,
        end: (index + 1) * 0.5,
        type: "word",
        speaker_id:
          request.speakerCount && request.speakerCount > 1
            ? `Speaker ${(index % request.speakerCount) + 1}`
            : undefined,
      }));

    return {
      text: mockText,
      words,
      speakers:
        request.speakerCount && request.speakerCount > 1
          ? Array.from(
              { length: request.speakerCount },
              (_, i) => `Speaker ${i + 1}`,
            )
          : undefined,
      language_code: request.language || "en",
    };
  }
}

// Singleton instance
let elevenLabsClient: ElevenLabsClient | null = null;

export function getElevenLabsClient(): ElevenLabsClient {
  if (!elevenLabsClient) {
    elevenLabsClient = new ElevenLabsClient();
  }
  return elevenLabsClient;
}

// Helper to check if ElevenLabs is configured
export function isElevenLabsConfigured(): boolean {
  try {
    const config = getConfig();
    return !!config.stt?.elevenlabs?.apiKey;
  } catch {
    return false;
  }
}
