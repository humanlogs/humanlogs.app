import { getConfig } from "./config";
import { ElevenLabsClient as ElevenLabsSDK } from "@elevenlabs/elevenlabs-js";

export interface TranscriptionWord {
  word: string;
  start: number;
  end: number;
  speaker?: string;
}

export interface TranscriptionResult {
  text: string;
  words: TranscriptionWord[];
  speakers?: string[];
  language?: string;
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

class ElevenLabsClient {
  private client: ElevenLabsSDK;

  constructor() {
    const config = getConfig();
    this.client = new ElevenLabsSDK({
      apiKey: config.elevenlabs.apiKey,
    });
  }

  /**
   * Transcribe audio using ElevenLabs Speech-to-Text API (synchronous)
   * Uses cloud_storage_url to pass the signed URL directly to ElevenLabs
   */
  async transcribeFromUrl(
    request: TranscriptionRequest,
  ): Promise<TranscriptionResult> {
    try {
      const response = await this.client.speechToText.convert({
        modelId: "scribe_v2",
        cloudStorageUrl: request.audioUrl,
        languageCode: request.language || undefined,
        numSpeakers: request.speakerCount || undefined,
        diarize: request.speakerCount ? request.speakerCount > 1 : false,
        timestampsGranularity: "word",
        keyterms:
          request.vocabulary && request.vocabulary.length > 0
            ? request.vocabulary
            : undefined,
      });

      // Cast to unknown first to work with SDK's complex union types
      const result = response as unknown as Record<string, unknown>;

      // Handle single channel response
      if ("text" in result && "words" in result && !("transcripts" in result)) {
        return this.mapSingleChannelResponse(result);
      }

      // Handle multichannel response
      if ("transcripts" in result && Array.isArray(result.transcripts)) {
        return this.mapMultichannelResponse(result);
      }

      throw new Error("Unexpected response format from ElevenLabs API");
    } catch (error) {
      console.error("Error transcribing with ElevenLabs:", error);
      throw error;
    }
  }

  /**
   * Transcribe audio file directly by uploading it
   * Use this when the file is local and cannot be accessed via URL
   */
  async transcribeFromFile(
    request: TranscriptionFileRequest,
  ): Promise<TranscriptionResult> {
    try {
      // Create a File-like object from the buffer
      // Convert Buffer to Uint8Array which is compatible with File API
      const uint8Array = new Uint8Array(request.fileBuffer);
      const file = new File([uint8Array], request.fileName, {
        type: "audio/mpeg", // ElevenLabs auto-detects format
      });

      const response = await this.client.speechToText.convert({
        modelId: "scribe_v2",
        file,
        languageCode: request.language || undefined,
        numSpeakers: request.speakerCount || undefined,
        diarize: request.speakerCount ? request.speakerCount > 1 : false,
        timestampsGranularity: "word",
        keyterms:
          request.vocabulary && request.vocabulary.length > 0
            ? request.vocabulary
            : undefined,
      });

      // Cast to unknown first to work with SDK's complex union types
      const result = response as unknown as Record<string, unknown>;

      // Handle single channel response
      if ("text" in result && "words" in result && !("transcripts" in result)) {
        return this.mapSingleChannelResponse(result);
      }

      // Handle multichannel response
      if ("transcripts" in result && Array.isArray(result.transcripts)) {
        return this.mapMultichannelResponse(result);
      }

      throw new Error("Unexpected response format from ElevenLabs API");
    } catch (error) {
      console.error("Error transcribing with ElevenLabs:", error);
      throw error;
    }
  }

  /**
   * Map single channel response to our format
   */
  private mapSingleChannelResponse(
    response: Record<string, unknown>,
  ): TranscriptionResult {
    const responseWords =
      (response.words as Array<Record<string, unknown>>) || [];
    const words: TranscriptionWord[] = responseWords
      .filter((w) => w.type === "word") // Filter out spacing and audio_events
      .map((w) => ({
        word: String(w.text || ""),
        start: Number(w.start || 0),
        end: Number(w.end || 0),
        speaker: w.speaker_id ? String(w.speaker_id) : undefined,
      }));

    // Extract unique speakers from words
    const speakerIds = new Set(
      words.map((w) => w.speaker).filter((s): s is string => s !== undefined),
    );

    return {
      text: String(response.text || ""),
      words,
      speakers: speakerIds.size > 0 ? Array.from(speakerIds) : undefined,
      language: response.language_code
        ? String(response.language_code)
        : undefined,
    };
  }

  /**
   * Map multichannel response to our format
   * Combines all channels into a single transcription
   */
  private mapMultichannelResponse(
    response: Record<string, unknown>,
  ): TranscriptionResult {
    const allWords: TranscriptionWord[] = [];
    const allSpeakers = new Set<string>();
    let combinedText = "";

    const transcripts =
      (response.transcripts as Array<Record<string, unknown>>) || [];

    for (const transcript of transcripts) {
      if (transcript.text) {
        combinedText += (combinedText ? " " : "") + String(transcript.text);
      }

      const transcriptWords =
        (transcript.words as Array<Record<string, unknown>>) || [];
      const channelWords = transcriptWords
        .filter((w) => w.type === "word")
        .map((w) => ({
          word: String(w.text || ""),
          start: Number(w.start || 0),
          end: Number(w.end || 0),
          speaker: w.speaker_id ? String(w.speaker_id) : undefined,
        }));

      allWords.push(...channelWords);

      channelWords.forEach((word) => {
        if (word.speaker) allSpeakers.add(word.speaker);
      });
    }

    // Sort words by start time
    allWords.sort((a, b) => a.start - b.start);

    const firstTranscript = transcripts[0] as
      | Record<string, unknown>
      | undefined;

    return {
      text: combinedText,
      words: allWords,
      speakers: allSpeakers.size > 0 ? Array.from(allSpeakers) : undefined,
      language: firstTranscript?.language_code
        ? String(firstTranscript.language_code)
        : undefined,
    };
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
        word,
        start: index * 0.5,
        end: (index + 1) * 0.5,
        speaker:
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
      language: request.language || "en",
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
    return !!config.elevenlabs?.apiKey;
  } catch {
    return false;
  }
}
