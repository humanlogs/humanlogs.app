import { getConfig } from "../config";
import { getElevenLabsClient, isElevenLabsConfigured } from "./elevenlabs";
import { getWhisperClient, isWhisperConfigured } from "./whisper";
import type {
  TranscriptionRequest,
  TranscriptionFileRequest,
  TranscriptionResult,
  AsyncTranscriptionResponse,
  TranscriptionStatus,
} from "./elevenlabs"; // Using ElevenLabs types as the base interface

/**
 * Unified STT Service that abstracts between different providers
 */
class STTService {
  private provider: "elevenlabs" | "whisper";

  constructor() {
    const config = getConfig();
    this.provider = config.stt.type;
  }

  /**
   * Get the current provider name
   */
  getProvider(): "elevenlabs" | "whisper" {
    return this.provider;
  }

  /**
   * Check if STT service is configured
   */
  isConfigured(): boolean {
    switch (this.provider) {
      case "elevenlabs":
        return isElevenLabsConfigured();
      case "whisper":
        return isWhisperConfigured();
      default:
        return false;
    }
  }

  /**
   * Start an async transcription job from a file
   */
  async transcribeFromFileAsync(
    request: TranscriptionFileRequest,
  ): Promise<AsyncTranscriptionResponse> {
    switch (this.provider) {
      case "elevenlabs": {
        const client = getElevenLabsClient();
        return client.transcribeFromFileAsync(request);
      }
      case "whisper": {
        const client = getWhisperClient();
        return client.transcribeFromFileAsync(request);
      }
      default:
        throw new Error(`Unsupported STT provider: ${this.provider}`);
    }
  }

  /**
   * Start an async transcription job from a URL
   */
  async transcribeFromUrlAsync(
    request: TranscriptionRequest,
  ): Promise<AsyncTranscriptionResponse> {
    switch (this.provider) {
      case "elevenlabs": {
        const client = getElevenLabsClient();
        return client.transcribeFromUrlAsync(request);
      }
      case "whisper": {
        const client = getWhisperClient();
        return client.transcribeFromUrlAsync(request);
      }
      default:
        throw new Error(`Unsupported STT provider: ${this.provider}`);
    }
  }

  /**
   * Get the status and result of an async transcription
   */
  async getTranscriptionStatus(
    transcriptionId: string,
  ): Promise<TranscriptionStatus> {
    // Determine provider from transcription ID prefix
    if (transcriptionId.startsWith("whisper-")) {
      const client = getWhisperClient();
      return client.getTranscriptionStatus(transcriptionId);
    } else {
      // Default to ElevenLabs for backward compatibility
      const client = getElevenLabsClient();
      return client.getTranscriptionStatus(transcriptionId);
    }
  }

  /**
   * Delete a transcription from the provider's servers
   * NOTE: This is typically not needed as getTranscriptionStatus() automatically
   * deletes transcriptions after retrieving completed or failed results
   * @deprecated Use getTranscriptionStatus() which handles deletion automatically
   */
  async deleteTranscription(transcriptionId: string): Promise<void> {
    // Determine provider from transcription ID prefix
    if (transcriptionId.startsWith("whisper-")) {
      // Whisper doesn't support deletion (local processing)
      console.log(
        "Skipping deletion for Whisper transcription (local processing)",
      );
      return;
    } else {
      // Delete from ElevenLabs
      const client = getElevenLabsClient();
      return client.deleteTranscription(transcriptionId);
    }
  }

  /**
   * Simulate transcription for development
   */
  async simulateTranscription(
    request: TranscriptionRequest,
    durationMinutes: number,
  ): Promise<TranscriptionResult> {
    switch (this.provider) {
      case "elevenlabs": {
        const client = getElevenLabsClient();
        return client.simulateTranscription(request, durationMinutes);
      }
      case "whisper": {
        const client = getWhisperClient();
        return client.simulateTranscription(request, durationMinutes);
      }
      default:
        throw new Error(`Unsupported STT provider: ${this.provider}`);
    }
  }

  /**
   * Get provider-specific capabilities
   */
  getCapabilities(): {
    supportsSpeakerDiarization: boolean;
    supportsCustomVocabulary: boolean;
    supportsMultiChannel: boolean;
    maxFileSizeMB: number;
  } {
    switch (this.provider) {
      case "elevenlabs":
        return {
          supportsSpeakerDiarization: true,
          supportsCustomVocabulary: true,
          supportsMultiChannel: true,
          maxFileSizeMB: 500,
        };
      case "whisper":
        return {
          supportsSpeakerDiarization: false, // Whisper does not support diarization natively
          supportsCustomVocabulary: false, // Whisper does not support custom vocabulary
          supportsMultiChannel: false,
          maxFileSizeMB: 0, // Depends on server configuration
        };
      default:
        return {
          supportsSpeakerDiarization: false,
          supportsCustomVocabulary: false,
          supportsMultiChannel: false,
          maxFileSizeMB: 0,
        };
    }
  }
}

// Singleton instance
let sttService: STTService | null = null;

/**
 * Get the STT service singleton
 */
export function getSTTService(): STTService {
  if (!sttService) {
    sttService = new STTService();
  }
  return sttService;
}

// Re-export types for convenience
export type {
  TranscriptionRequest,
  TranscriptionFileRequest,
  TranscriptionResult,
  AsyncTranscriptionResponse,
  TranscriptionStatus,
  TranscriptionWord,
} from "./elevenlabs";
