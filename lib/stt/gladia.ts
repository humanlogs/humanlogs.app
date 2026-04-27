import FormData from "form-data";
import { getConfig } from "../config";

// Re-use the types from elevenlabs
export interface TranscriptionWord {
  text: string;
  start: number;
  end: number;
  type?: string;
  speaker_id?: string;
  [key: string]: unknown;
}

export interface TranscriptionChannel {
  text: string;
  words: TranscriptionWord[];
  language_code?: string;
  [key: string]: unknown;
}

export interface TranscriptionResult {
  text: string;
  words: TranscriptionWord[];
  speakers?: string[];
  language_code?: string;
  transcripts?: TranscriptionChannel[];
  [key: string]: unknown;
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

class GladiaClient {
  private apiKey: string;
  private baseUrl = "https://api.gladia.io";
  private useWebhook: boolean;
  private webhookUrl: string;

  constructor() {
    const config = getConfig();
    this.apiKey = config.stt.gladia.apiKey;
    this.useWebhook = config.stt.gladia.useWebhook || false;
    this.webhookUrl = config.stt.gladia.webhookUrl || "";
  }

  /**
   * Get common headers for Gladia API
   */
  private getHeaders(): Record<string, string> {
    return {
      "x-gladia-key": this.apiKey,
    };
  }

  /**
   * Upload a file to Gladia and get the audio URL
   */
  private async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
  ): Promise<string> {
    const form = new FormData();
    form.append("audio", fileBuffer, {
      filename: fileName,
      contentType: "audio/mpeg",
    });

    const response = await fetch(`${this.baseUrl}/v2/upload`, {
      method: "POST",
      headers: {
        ...form.getHeaders(),
        ...this.getHeaders(),
      },
      body: form as any,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data?.audio_url) {
      throw new Error("No audio_url returned from upload");
    }

    return data.audio_url;
  }

  /**
   * Build transcription request parameters
   */
  private buildTranscriptionParams(
    request: TranscriptionRequest | TranscriptionFileRequest,
    audioUrl: string,
  ) {
    const params: Record<string, unknown> = {
      audio_url: audioUrl,
    };

    // Add webhook configuration if enabled
    if (this.useWebhook && this.webhookUrl) {
      params.callback = true;
      params.callback_config = {
        url: this.webhookUrl,
        method: "POST",
      };
    }

    // Add language configuration
    if (request.language) {
      params.language_config = {
        languages: [request.language],
        code_switching: false,
      };
    }

    // Add diarization (speaker identification)
    if (request.speakerCount && request.speakerCount > 1) {
      params.diarization = true;
      params.diarization_config = {
        number_of_speakers: request.speakerCount,
        enhanced: true,
      };
    }

    // Add custom vocabulary
    if (request.vocabulary && request.vocabulary.length > 0) {
      params.custom_vocabulary = true;
      params.custom_vocabulary_config = {
        default_intensity: 0.5,
        vocabulary: request.vocabulary.map((word) => ({
          value: word,
          intensity: 0.5,
          pronunciations: [],
          language: request.language || "en",
        })),
      };
    }

    return params;
  }

  /**
   * Start an async transcription job from a file
   * Returns a transcription ID that can be used to check status later
   */
  async transcribeFromFileAsync(
    request: TranscriptionFileRequest,
  ): Promise<AsyncTranscriptionResponse> {
    try {
      // First, upload the file
      const audioUrl = await this.uploadFile(
        request.fileBuffer,
        request.fileName,
      );

      // Then, start the transcription
      const params = this.buildTranscriptionParams(request, audioUrl);

      const response = await fetch(`${this.baseUrl}/v2/pre-recorded`, {
        method: "POST",
        headers: {
          ...this.getHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error(`Transcription failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data?.id) {
        throw new Error("No transcription ID returned from Gladia");
      }

      return {
        transcriptionId: `gladia-${data.id}`,
        message: "Transcription started",
      };
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
      const params = this.buildTranscriptionParams(request, request.audioUrl);

      const response = await fetch(`${this.baseUrl}/v2/pre-recorded`, {
        method: "POST",
        headers: {
          ...this.getHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error(`Transcription failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data?.id) {
        throw new Error("No transcription ID returned from Gladia");
      }

      return {
        transcriptionId: `gladia-${data.id}`,
        message: "Transcription started",
      };
    } catch (error) {
      console.error("Error starting async transcription:", error);
      throw error;
    }
  }

  /**
   * Get the status and result of an async transcription
   *
   * When webhook mode is enabled, this method always returns "pending" status
   * because the transcription result will be delivered via webhook callback
   * and processed by the webhook endpoint.
   *
   * When webhook mode is disabled, this method polls Gladia API for the status
   * and automatically deletes the transcription from Gladia once completed or failed
   * to ensure no data is retained on their servers.
   */
  async getTranscriptionStatus(
    transcriptionId: string,
  ): Promise<TranscriptionStatus> {
    // If webhook mode is enabled, always return pending
    // The transcription will be updated via webhook callback
    if (this.useWebhook) {
      return { status: "pending" };
    }

    // Otherwise, poll Gladia API for status
    try {
      // Remove the "gladia-" prefix to get the real ID
      const realId = transcriptionId.replace(/^gladia-/, "");

      // Get the transcription status by ID
      const response = await fetch(
        `${this.baseUrl}/v2/pre-recorded/${realId}`,
        {
          method: "GET",
          headers: this.getHeaders(),
        },
      );

      if (!response.ok) {
        if (response.status === 404) {
          return { status: "pending" };
        }
        throw new Error(`Failed to get status: ${response.statusText}`);
      }

      const data = await response.json();

      // Check if transcription is completed
      if (data.status === "done") {
        // TODO: Map the result properly (ignoring for now as requested)
        // For now, return raw result
        await this.deleteTranscription(transcriptionId);

        return {
          status: "completed",
          transcription: data.result as TranscriptionResult,
        };
      }

      // Check for error status
      if (data.status === "error" || data.status === "failed") {
        await this.deleteTranscription(transcriptionId);

        return {
          status: "failed",
          error: data.error || "Transcription failed",
        };
      }

      // Check for processing status
      if (data.status === "processing" || data.status === "transcribing") {
        return { status: "processing" };
      }

      // Default to pending
      return { status: "pending" };
    } catch (error) {
      console.error("Error getting transcription status:", error);
      throw error;
    }
  }

  /**
   * Delete a transcription from Gladia servers
   * This should be called after successfully retrieving the transcription
   * to ensure data is not stored on their servers
   */
  async deleteTranscription(transcriptionId: string): Promise<void> {
    try {
      // Remove the "gladia-" prefix to get the real ID
      const realId = transcriptionId.replace(/^gladia-/, "");

      const response = await fetch(
        `${this.baseUrl}/v2/pre-recorded/${realId}`,
        {
          method: "DELETE",
          headers: this.getHeaders(),
        },
      );

      if (!response.ok) {
        throw new Error(`Delete failed: ${response.statusText}`);
      }

      console.log(
        `Successfully deleted transcription ${transcriptionId} from Gladia`,
      );
    } catch (error) {
      console.error(
        `Error deleting transcription ${transcriptionId} from Gladia:`,
        error,
      );
      // Don't throw - deletion failure shouldn't break the app
    }
  }
}

// Singleton instance
let gladiaClient: GladiaClient | null = null;

export function getGladiaClient(): GladiaClient {
  if (!gladiaClient) {
    gladiaClient = new GladiaClient();
  }
  return gladiaClient;
}

// Helper to check if Gladia is configured
export function isGladiaConfigured(): boolean {
  try {
    const config = getConfig();
    return !!config.stt?.gladia?.apiKey;
  } catch {
    return false;
  }
}
