import { getConfig } from "../config";

export interface TranscriptionWord {
  text: string;
  start: number;
  end: number;
  type?: string;
  speaker_id?: string;
  [key: string]: unknown;
}

export interface TranscriptionResult {
  text: string;
  words: TranscriptionWord[];
  speakers?: string[];
  language_code?: string;
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

class WhisperClient {
  private apiUrl: string;
  private modelSize: string;

  constructor() {
    const config = getConfig();
    this.apiUrl = config.stt.whisper.apiUrl;
    this.modelSize = config.stt.whisper.modelSize || "base";
  }

  /**
   * Start an async transcription job from a file
   * For Whisper, we'll transcribe synchronously and return a fake ID
   */
  async transcribeFromFileAsync(
    request: TranscriptionFileRequest,
  ): Promise<AsyncTranscriptionResponse> {
    try {
      // Generate a unique ID for this transcription
      const transcriptionId = `whisper-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Start transcription in background (you could use a job queue for this)
      this.transcribeFile(request)
        .then((result) => {
          // Store result in memory or database for later retrieval
          this.storeTranscriptionResult(transcriptionId, result);
        })
        .catch((error) => {
          console.error("Whisper transcription error:", error);
          this.storeTranscriptionError(transcriptionId, error.message);
        });

      return {
        transcriptionId,
        message: "Whisper transcription started",
      };
    } catch (error) {
      console.error("Error starting Whisper transcription:", error);
      throw error;
    }
  }

  /**
   * Start an async transcription job from a URL
   * Download the file first, then transcribe
   */
  async transcribeFromUrlAsync(
    request: TranscriptionRequest,
  ): Promise<AsyncTranscriptionResponse> {
    try {
      // Download the file from URL
      const response = await fetch(request.audioUrl);
      if (!response.ok) {
        throw new Error(`Failed to download audio: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const fileName = request.audioUrl.split("/").pop() || "audio.mp3";

      // Use file transcription
      return this.transcribeFromFileAsync({
        fileBuffer: buffer,
        fileName,
        language: request.language,
        speakerCount: request.speakerCount,
        vocabulary: request.vocabulary,
      });
    } catch (error) {
      console.error("Error starting Whisper transcription from URL:", error);
      throw error;
    }
  }

  /**
   * Transcribe a file using local Whisper instance
   */
  private async transcribeFile(
    request: TranscriptionFileRequest,
  ): Promise<TranscriptionResult> {
    try {
      const formData = new FormData();

      // Create a blob from the buffer
      const blob = new Blob([new Uint8Array(request.fileBuffer)], {
        type: "audio/mpeg",
      });
      formData.append("file", blob, request.fileName);

      // Whisper API parameters
      formData.append("model", this.modelSize);
      formData.append("response_format", "verbose_json");
      formData.append("timestamp_granularities[]", "word");

      if (request.language) {
        formData.append("language", request.language);
      }

      // Note: Whisper provides transcription and word-level timestamps
      // Speaker diarization is NOT a Whisper feature - it requires separate tools like pyannote.audio
      // Custom vocabulary is also not supported by Whisper
      // The speakerCount and vocabulary parameters are accepted but may be ignored by the server

      const response = await fetch(`${this.apiUrl}/v1/audio/transcriptions`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Whisper API error: ${response.statusText} - ${errorText}`,
        );
      }

      const result = await response.json();
      return this.mapResponse(result as Record<string, unknown>);
    } catch (error) {
      console.error("Error transcribing with Whisper:", error);
      throw error;
    }
  }

  /**
   * Get the status and result of an async transcription
   */
  async getTranscriptionStatus(
    transcriptionId: string,
  ): Promise<TranscriptionStatus> {
    // Retrieve from storage (you should implement actual storage)
    const result = this.retrieveTranscriptionResult(transcriptionId);

    if (result) {
      return {
        status: "completed",
        transcription: result,
      };
    }

    const error = this.retrieveTranscriptionError(transcriptionId);
    if (error) {
      return {
        status: "failed",
        error,
      };
    }

    // If neither result nor error, it's still processing
    return { status: "processing" };
  }

  /**
   * Map Whisper response to our standard format
   */
  private mapResponse(response: Record<string, unknown>): TranscriptionResult {
    const text = String(response.text || "");
    const words: TranscriptionWord[] = [];

    // Whisper returns words in a specific format
    if ("words" in response && Array.isArray(response.words)) {
      const whisperWords = response.words as Array<Record<string, unknown>>;
      words.push(
        ...whisperWords.map((w) => ({
          text: String(w.word || w.text || ""),
          start: Number(w.start || 0),
          end: Number(w.end || 0),
          type: "word",
          ...w,
        })),
      );
    } else if (text) {
      // If no word-level timestamps, create words from text
      // This is a fallback and won't have accurate timestamps
      const textWords = text.split(/\s+/);
      textWords.forEach((word, index) => {
        words.push({
          text: word,
          start: index * 0.5, // Rough estimate
          end: (index + 1) * 0.5,
          type: "word",
        });
      });
    }

    return {
      text,
      words,
      language_code: response.language ? String(response.language) : undefined,
      ...response,
    };
  }

  /**
   * Simulate transcription for development/testing
   */
  async simulateTranscription(
    request: TranscriptionRequest,
    durationMinutes: number,
  ): Promise<TranscriptionResult> {
    // Simulate processing time
    const processingTime = Math.min(durationMinutes * 1000, 5000);
    await new Promise((resolve) => setTimeout(resolve, processingTime));

    const mockText = `This is a simulated Whisper transcription for development. 
The audio was ${durationMinutes} minutes long and was set to ${request.language || "auto"} language.`;

    const words: TranscriptionWord[] = mockText
      .split(" ")
      .map((word, index) => ({
        text: word,
        start: index * 0.5,
        end: (index + 1) * 0.5,
        type: "word",
      }));

    return {
      text: mockText,
      words,
      language_code: request.language || "en",
    };
  }

  // Temporary in-memory storage for transcription results
  // In production, use Redis, database, or file system
  private transcriptionResults = new Map<string, TranscriptionResult>();
  private transcriptionErrors = new Map<string, string>();

  private storeTranscriptionResult(
    id: string,
    result: TranscriptionResult,
  ): void {
    this.transcriptionResults.set(id, result);
  }

  private storeTranscriptionError(id: string, error: string): void {
    this.transcriptionErrors.set(id, error);
  }

  private retrieveTranscriptionResult(
    id: string,
  ): TranscriptionResult | undefined {
    return this.transcriptionResults.get(id);
  }

  private retrieveTranscriptionError(id: string): string | undefined {
    return this.transcriptionErrors.get(id);
  }
}

// Singleton instance
let whisperClient: WhisperClient | null = null;

export function getWhisperClient(): WhisperClient {
  if (!whisperClient) {
    whisperClient = new WhisperClient();
  }
  return whisperClient;
}

// Helper to check if Whisper is configured
export function isWhisperConfigured(): boolean {
  try {
    const config = getConfig();
    return !!config.stt?.whisper?.apiUrl;
  } catch {
    return false;
  }
}
