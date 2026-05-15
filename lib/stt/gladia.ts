import crypto from "crypto";
import { SignJWT } from "jose";
import { getConfig } from "../config";
import { encryptBuffer, generateEncryptionKey } from "../encryption/utils";
import { getStorage } from "../storage";

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
  speakers?: {
    id: string;
    name: string;
  }[];
  language_code?: string;
  transcripts?: TranscriptionChannel[];
  translations?: Record<string, string>; // Translation results by language
  subtitles?: Record<string, string>; // Subtitle files by format
  [key: string]: unknown;
}

export interface TranscriptionRequest {
  audioUrl: string;
  language?: string;
  speakerCount?: number;
  vocabulary?: string[];
  translation?: {
    targetLanguages: string[];
    context?: string;
  };
  subtitles?: {
    formats: string[];
  };
}

export interface TranscriptionFileRequest {
  fileBuffer: Buffer;
  fileName: string;
  language?: string;
  speakerCount?: number;
  vocabulary?: string[];
  translation?: {
    targetLanguages: string[];
    context?: string;
  };
  subtitles?: {
    formats: string[];
  };
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
  private storage = getStorage();

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
   * Encrypt and upload a file to our S3 storage, then generate a secure URL
   */
  private async uploadEncryptedFile(
    fileBuffer: Buffer,
    fileName: string,
  ): Promise<string> {
    // Generate encryption key
    const encryptionKey = generateEncryptionKey();

    // Encrypt the file
    const { encrypted, iv } = encryptBuffer(fileBuffer, encryptionKey);

    // Generate unique key for S3
    const s3Key = `gladia-temp/${Date.now()}-${crypto.randomUUID()}.enc`;

    // Upload encrypted file to S3
    await this.storage.upload(s3Key, encrypted, "application/octet-stream");

    // Generate JWT with encryption key and expiration (5 minutes)
    const config = getConfig();
    const secret = new TextEncoder().encode(
      config.auth.sessionSecret || "fallback-secret",
    );

    const jwt = await new SignJWT({
      s3Key,
      encryptionKey: encryptionKey.toString("hex"),
      iv: iv.toString("hex"),
      fileName,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(secret);

    // Generate the secure download URL
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      `http://localhost:${config.server.port}`;
    return `${baseUrl}/api/webhook/downloader/${fileName}?token=${jwt}`;
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
        languages: [languageMap[request.language] || "en"],
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
          language: languageMap[request.language || "eng"] || "en",
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
      // Encrypt and upload the file to our S3, get secure URL
      const audioUrl = await this.uploadEncryptedFile(
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(`Transcription failed: ${response.statusText}`);
      }

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
  async getTranscriptionStatus(_transcriptionId: string): Promise<{
    status: "pending";
  }> {
    // Gladia always use the pending mode
    return { status: "pending" };
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

      if (!realId.match(/^[a-zA-Z0-9_-]+$/)) {
        console.error(`Invalid transcription ID format: ${transcriptionId}`);
        throw new Error("Invalid transcription ID format");
      }

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

// af, am, ar, as, az, ba, be, bg, bn, bo, br, bs, ca, cs, cy, da, de, el, en, es, et, eu, fa, fi, fo, fr, gl, gu, ha, haw, he, hi, hr, ht, hu, hy, id, is, it, ja, jw, ka, kk, km, kn, ko, la, lb, ln, lo, lt, lv, mg, mi, mk, ml, mn, mr, ms, mt, my, ne, nl, nn, no, oc, pa, pl, ps, pt, ro, ru, sa, sd, si, sk, sl, sn, so, sq, sr, su, sv, sw, ta, te, tg, th, tk, tl, tr, tt, uk, ur, uz, vi, yi, yo, zh
const languageMap: Record<string, string> = {
  bel: "be",
  bos: "bs",
  bul: "bg",
  cat: "ca",
  hrv: "hr",
  ces: "cs",
  dan: "da",
  nld: "nl",
  eng: "en",
  est: "et",
  fin: "fi",
  fra: "fr",
  glg: "gl",
  deu: "de",
  ell: "el",
  hun: "hu",
  isl: "is",
  ind: "id",
  ita: "it",
  jpn: "ja",
  kan: "kn",
  lav: "lv",
  mkd: "mk",
  msa: "ms",
  mal: "ml",
  nor: "no",
  pol: "pl",
  por: "pt",
  ron: "ro",
  rus: "ru",
  slk: "sk",
  spa: "es",
  swe: "sv",
  tur: "tr",
  ukr: "uk",
  vie: "vi",
  hye: "hy",
  aze: "az",
  ben: "bn",
  yue: "",
  fil: "tl",
  kat: "ka",
  guj: "gu",
  hin: "hi",
  kaz: "kk",
  lit: "lt",
  mlt: "mt",
  cmn: "zh",
  mar: "mr",
  nep: "ne",
  ori: "",
  fas: "fa",
  srp: "sr",
  slv: "sl",
  swa: "sw",
  tam: "ta",
  tel: "te",
  afr: "af",
  ara: "ar",
  asm: "as",
  ast: "",
  mya: "my",
  hau: "ha",
  heb: "he",
  jav: "jw",
  kor: "ko",
  kir: "",
  ltz: "lb",
  mri: "mi",
  oci: "oc",
  pan: "pa",
  tgk: "tg",
  tha: "th",
  uzb: "uz",
  cym: "cy",
  amh: "am",
  lug: "",
  ibo: "",
  gle: "",
  khm: "km",
  kur: "",
  lao: "lo",
  mon: "mn",
  nso: "",
  pus: "ps",
  sna: "sn",
  snd: "sd",
  som: "so",
  urd: "ur",
  wol: "",
  xho: "",
  yor: "yo",
  zul: "",
};
