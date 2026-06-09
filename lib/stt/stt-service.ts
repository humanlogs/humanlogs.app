import { getConfig } from "../config";
import { getElevenLabsClient, isElevenLabsConfigured } from "./elevenlabs";
import { getWhisperClient, isWhisperConfigured } from "./whisper";
import { getGladiaClient, isGladiaConfigured } from "./gladia";
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
export type SttProvider = "elevenlabs" | "whisper" | "gladia";

/** User-facing data residency preference mapped to a concrete provider. */
export type SttResidency = "eu" | "us";

class STTService {
  private provider: SttProvider;

  constructor(provider?: SttProvider) {
    const config = getConfig();
    this.provider = provider ?? config.stt.type;
  }

  /**
   * Get the current provider name
   */
  getProvider(): "elevenlabs" | "whisper" | "gladia" {
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
      case "gladia":
        return isGladiaConfigured();
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
      case "gladia": {
        const client = getGladiaClient();
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
      case "gladia": {
        const client = getGladiaClient();
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
    } else if (transcriptionId.startsWith("gladia-")) {
      const client = getGladiaClient();
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
    } else if (transcriptionId.startsWith("gladia-")) {
      // Delete from Gladia
      const client = getGladiaClient();
      return client.deleteTranscription(transcriptionId);
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

// Cache one service instance per provider
const sttServices = new Map<SttProvider, STTService>();

/**
 * Check whether a given provider is configured on this deployment.
 */
function isProviderConfigured(provider: SttProvider): boolean {
  switch (provider) {
    case "elevenlabs":
      return isElevenLabsConfigured();
    case "whisper":
      return isWhisperConfigured();
    case "gladia":
      return isGladiaConfigured();
    default:
      return false;
  }
}

/**
 * Map a data residency preference ("eu"/"us") to a concrete provider.
 * EU -> Gladia (European servers), US -> ElevenLabs.
 */
export function residencyToProvider(residency: SttResidency): SttProvider {
  return residency === "us" ? "elevenlabs" : "gladia";
}

/**
 * Resolve a requested provider/residency to a provider that is actually
 * configured on this deployment, falling back to the configured default.
 *
 * Accepts a concrete provider name, a residency ("eu"/"us"), or undefined.
 */
export function resolveSttProvider(
  requested?: string | null,
): SttProvider {
  const fallback = getConfig().stt.type;

  if (!requested) return fallback;

  let provider: SttProvider;
  if (requested === "eu" || requested === "us") {
    provider = residencyToProvider(requested);
  } else if (
    requested === "elevenlabs" ||
    requested === "whisper" ||
    requested === "gladia"
  ) {
    provider = requested;
  } else {
    // Unknown value — use the configured default
    return fallback;
  }

  // Only honour the request if that provider is configured, otherwise default
  return isProviderConfigured(provider) ? provider : fallback;
}

/**
 * Report which providers are available so the UI can decide whether to show
 * the EU/US model selector.
 */
export function getAvailableSttProviders(): {
  eu: boolean;
  us: boolean;
  whisper: boolean;
  default: SttResidency;
} {
  const defaultProvider = getConfig().stt.type;
  return {
    eu: isGladiaConfigured(),
    us: isElevenLabsConfigured(),
    whisper: isWhisperConfigured(),
    default: defaultProvider === "elevenlabs" ? "us" : "eu",
  };
}

/**
 * Get the STT service for a given provider (defaults to the configured one).
 */
export function getSTTService(provider?: SttProvider): STTService {
  const resolved = provider ?? getConfig().stt.type;
  let service = sttServices.get(resolved);
  if (!service) {
    service = new STTService(resolved);
    sttServices.set(resolved, service);
  }
  return service;
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
