import {
  checkFfmpegAvailable,
  compressAudioFile,
  encryptAudioBuffer,
} from "@/lib/audio/audio-processing";
import {
  parseMultipartToDisk,
  type StreamedFile,
} from "@/lib/audio/multipart-upload";
import { isBillableVersion } from "@/lib/billing/stripe";
import { prisma } from "@/lib/prisma";
import { withAuthRateLimit } from "@/lib/router/rate-limit-middleware";
import { generateAudioKey, getStorage } from "@/lib/storage";
import { parseSpeakers } from "@/lib/transcriptions/speakers";
import {
  getSTTService,
  resolveSttProvider,
  type SttProvider,
} from "@/lib/stt/stt-service";
import crypto from "crypto";
import { readFile, unlink } from "fs/promises";
import { NextResponse } from "next/server";
import { v4 } from "uuid";
import { EncryptionUtils } from "../../../../lib/encryption/encryption-entities";

export const dynamic = "force-dynamic";

// Maximum file size: 300MB
const MAX_FILE_SIZE = 300 * 1024 * 1024;

// Supported audio and video formats (ffmpeg can handle these)
const SUPPORTED_FORMATS = [
  // Audio formats
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/flac",
  "audio/aac",
  "audio/ogg",
  "audio/opus",
  "audio/webm",
  "audio/x-ms-wma",
  "audio/aiff",
  "audio/x-aiff",
  // Video formats (audio will be extracted)
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
  "video/webm",
  "video/x-flv",
  "video/x-ms-wmv",
  "video/mpeg",
  "video/3gpp",
];

export const POST = withAuthRateLimit(async (request, user) => {
  // Parsed upload is streamed to temp files; keep a handle so we can clean up
  // any file that is not handed off to a background job.
  let parsed: Awaited<ReturnType<typeof parseMultipartToDisk>> | null = null;
  const handedOff = new Set<string>();

  try {
    // Parse multipart form data, streaming file parts straight to disk so the
    // (potentially very large) audio/video bytes are never held in memory.
    parsed = await parseMultipartToDisk(request, { maxFileSize: MAX_FILE_SIZE });
    const fields = parsed.fields;

    // Extract form fields
    const language = fields.language || "en";
    const projectId = fields.projectId || "";
    const speakerCountRaw = fields.speakerCount;
    const speakerCount = speakerCountRaw ? parseInt(speakerCountRaw, 10) : 2;
    const tagAudioEventsRaw = fields.tagAudioEvents;
    const tagAudioEvents =
      typeof tagAudioEventsRaw === "string"
        ? tagAudioEventsRaw.toLowerCase() !== "false"
        : true;

    const vocabulary = fields.vocabulary || "";
    const vocabularyArray = vocabulary
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

    // Resolve the STT provider: explicit request ("eu"/"us" or a provider name)
    // falls back to the user's saved data residency preference, then the
    // configured default. resolveSttProvider also guarantees the result is a
    // provider that is actually configured on this deployment.
    const requestedProvider = fields.provider || null;
    const userPref = await prisma.user.findUnique({
      where: { id: user.id },
      select: { dataResidency: true },
    });
    const provider: SttProvider = resolveSttProvider(
      requestedProvider || userPref?.dataResidency || null,
    );

    // Extract audio files (already streamed to disk), matched by field name.
    const audioFiles: StreamedFile[] = [];
    const fileNames: string[] = [];
    const fileDurations: number[] = [];

    let index = 0;
    while (true) {
      const file = parsed.files.find((f) => f.fieldName === `file_${index}`);
      if (!file) break;

      audioFiles.push(file);
      fileNames.push(fields[`fileName_${index}`] || file.filename);
      fileDurations.push(parseFloat(fields[`duration_${index}`] || "0"));
      index++;
    }

    // Validation
    if (audioFiles.length === 0) {
      await parsed.cleanup();
      return NextResponse.json(
        { error: "At least one audio file is required" },
        { status: 400 },
      );
    }

    // Validate file sizes and types
    for (const file of audioFiles) {
      if (file.truncated || file.size > MAX_FILE_SIZE) {
        await parsed.cleanup();
        return NextResponse.json(
          { error: `File ${file.filename} exceeds maximum size of 1GB` },
          { status: 400 },
        );
      }

      if (
        !SUPPORTED_FORMATS.includes(file.mimeType) &&
        !file.filename.match(
          /\.(mp3|wav|m4a|flac|aac|ogg|opus|wma|aiff|mp4|mov|avi|mkv|webm|flv|wmv|mpeg|mpg|3gp)$/i,
        )
      ) {
        await parsed.cleanup();
        return NextResponse.json(
          { error: `File ${file.filename} has unsupported format` },
          { status: 400 },
        );
      }
    }

    // Calculate total duration and credits needed
    const totalSeconds = fileDurations.reduce((sum, d) => sum + d, 0);
    const totalMinutes = Math.ceil(totalSeconds / 60);
    const creditsNeeded = totalMinutes;

    const isBillable = isBillableVersion();

    // Fetch user profile to check credits (only if billable)
    if (isBillable) {
      const userProfile = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          credits: true,
          creditsRefill: true,
          plan: true,
        },
      });

      if (!userProfile) {
        await parsed.cleanup();
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const availableCredits = userProfile.credits;
      if (availableCredits < creditsNeeded) {
        await parsed.cleanup();
        return NextResponse.json(
          {
            error: "Insufficient credits",
            needed: creditsNeeded,
            available: availableCredits,
          },
          { status: 402 }, // Payment Required
        );
      }
    }

    // Create transcription records and get file buffers
    const createdTranscriptions: string[] = [];

    try {
      // Deduct credits first (before processing files)
      if (isBillable) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            credits: {
              increment: -creditsNeeded,
            },
            creditsUsed: {
              increment: creditsNeeded,
            },
          },
        });
      }

      // Process files one at a time to avoid memory issues
      for (let i = 0; i < audioFiles.length; i++) {
        const file = audioFiles[i];
        const title = fileNames[i];
        const fileName = v4();
        const duration = fileDurations[i];
        // The client converts to standardized opus when the device can handle
        // it; when flagged, the server skips its own ffmpeg re-encoding.
        const preConverted = fields[`converted_${i}`] === "opus";

        console.log(
          `Creating transcription for file ${i + 1}/${audioFiles.length}: (${file.size} bytes)`,
        );

        // Create transcription record
        const transcription = await prisma.transcription.create({
          data: {
            user: {
              connect: { id: user.id },
            },
            project: {
              connect: projectId ? { id: projectId } : undefined,
            },
            title,
            audioFileName: fileName,
            audioFileSize: file.size,
            audioFileKey: "", // Will be updated after upload in async processing
            language,
            speakerCount: speakerCount || 16,
            vocabulary: vocabularyArray,
            sttProvider: provider,
            state: "PENDING",
          },
        });

        createdTranscriptions.push(transcription.id);
        console.log(`Transcription record created: ${transcription.id}`);

        // The uploaded bytes already live in a temp file on disk. Hand the path
        // to the background job, which reads/compresses from disk (never loading
        // the raw source into memory) and deletes the temp file when done.
        console.log(
          `Starting async processing for ${transcription.id} from ${file.tmpPath}`,
        );

        // Start async processing immediately - don't await
        processAudioAndTranscription(
          transcription.id,
          file.tmpPath,
          fileName,
          user.id,
          {
            language,
            speakerCount: speakerCount || 16,
            vocabulary: vocabularyArray,
            tagAudioEvents,
            duration,
            provider,
            preConverted,
          },
        ).catch((error) => {
          console.error(
            `Error processing audio and transcription ${transcription.id}:`,
            error,
          );
        });

        // The job now owns this temp file; do not clean it up on the request path.
        handedOff.add(file.tmpPath);

        console.log(`Async processing started for ${transcription.id}`);
      }

      // Return immediately - processing happens in background
      return NextResponse.json({
        success: true,
        transcriptions: createdTranscriptions,
        creditsUsed: creditsNeeded,
      });
    } catch (error) {
      // Rollback: delete any created transcriptions
      if (createdTranscriptions.length > 0) {
        await prisma.transcription.deleteMany({
          where: {
            id: { in: createdTranscriptions },
          },
        });
      }

      throw error;
    }
  } catch (error) {
    console.error("Error creating transcription:", error);
    // Clean up any temp files that were not handed off to a background job.
    if (parsed) {
      await Promise.all(
        parsed.files
          .filter((f) => !handedOff.has(f.tmpPath))
          .map((f) => unlink(f.tmpPath).catch(() => {})),
      );
    }
    return NextResponse.json(
      { error: "Failed to create transcription" },
      { status: 500 },
    );
  }
});

/**
 * Process audio file (compression, encryption, upload) and start transcription
 * This function runs asynchronously in the background
 */
async function processAudioAndTranscription(
  transcriptionId: string,
  inputPath: string,
  fileName: string,
  userId: string,
  options: {
    language: string;
    speakerCount: number;
    vocabulary: string[];
    tagAudioEvents: boolean;
    duration: number;
    provider: SttProvider;
    preConverted: boolean;
  },
): Promise<void> {
  let compressedPath: string | null = null;
  try {
    const storage = getStorage();

    // Compress audio file using ffmpeg. Compression reads the source and writes
    // the opus output on disk, so the large raw file never enters the heap.
    let audioPath: string; // File to store & transcribe (opus, or raw on fallback)
    if (options.preConverted) {
      // The client already produced standardized opus with the same parameters,
      // so re-encoding server-side would only waste CPU. Use it as-is.
      console.log(`Using client-converted opus for ${inputPath}, skipping ffmpeg`);
      audioPath = inputPath;
    } else {
      try {
        const ffmpegAvailable = await checkFfmpegAvailable();
        if (ffmpegAvailable) {
          console.log(`Compressing audio file ${inputPath}...`);
          compressedPath = await compressAudioFile(inputPath);
          audioPath = compressedPath;
        } else {
          console.warn(
            "ffmpeg not available, skipping compression. Install ffmpeg for optimal storage.",
          );
          audioPath = inputPath;
        }
      } catch (error) {
        console.error("Error compressing audio, using original:", error);
        audioPath = inputPath;
      }
    }

    // Load the file to store/transcribe into memory. When compressed this is
    // small (<= 50MB, bounded by compressAudioFile); only the no-ffmpeg
    // fallback reads the full raw source.
    const unencryptedFile: Buffer = await readFile(audioPath);

    // Get user's public key for encryption
    const userProfile = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        publicKey: true,
      },
    });

    let fileToStore = unencryptedFile;
    const useEncryption = userProfile?.publicKey ? true : false;

    if (useEncryption) {
      const encryption = new EncryptionUtils(crypto);
      const transcriptionDto = await encryption.createEncryptedDataEntity({}, [
        await encryption.createEncryptedAccessorEntity(
          userId,
          userProfile!.publicKey!,
        ),
      ]);

      const audioFileSecret = crypto.randomBytes(32).toString("base64");
      fileToStore = encryptAudioBuffer(unencryptedFile, audioFileSecret);

      // Update transcription with encryption metadata
      await prisma.transcription.update({
        where: { id: transcriptionId },
        data: {
          transcription: transcriptionDto as never,
          audioFileEncryption: (await encryption.createEncryptedDataEntity(
            audioFileSecret,
            [
              await encryption.createEncryptedAccessorEntity(
                userId,
                userProfile!.publicKey!,
              ),
            ],
          )) as never,
        },
      });
    }

    // Upload to storage
    const contentType = "audio/opus"; // Compressed opus file
    const storageKey = generateAudioKey(userId, transcriptionId, fileName);
    await storage.upload(storageKey, fileToStore, contentType);

    // Update transcription with storage key
    await prisma.transcription.update({
      where: { id: transcriptionId },
      data: { audioFileKey: storageKey },
    });

    // Start transcription job
    await processTranscription(transcriptionId, unencryptedFile, options);
  } catch (error) {
    console.error(
      `Error processing audio and transcription ${transcriptionId}:`,
      error,
    );

    // Update transcription with error
    await prisma.transcription.update({
      where: { id: transcriptionId },
      data: {
        state: "ERROR",
        errorMessage:
          error instanceof Error
            ? error.message
            : "Failed to process audio file",
      },
    });
  } finally {
    // Remove the temp files this job owns (uploaded source + compressed output).
    await unlink(inputPath).catch(() => {});
    if (compressedPath) {
      await unlink(compressedPath).catch(() => {});
    }
  }
}

/**
 * Process a transcription asynchronously
 * This function starts an async transcription job with ElevenLabs
 */
async function processTranscription(
  transcriptionId: string,
  file: string | Buffer, // Url, storage key, or file buffer (depending on implementation)
  options: {
    language: string;
    speakerCount: number;
    vocabulary: string[];
    tagAudioEvents: boolean;
    duration: number;
    provider: SttProvider;
  },
): Promise<void> {
  try {
    const storage = getStorage();
    const stt = getSTTService(options.provider);

    const isBuffer = Buffer.isBuffer(file);

    // Get audio URL or file path
    const audioUrl = isBuffer ? "" : await storage.getUrl(file, 7200); // 2 hours

    if (stt.isConfigured()) {
      // Use real STT API (async)
      console.log(
        `Starting ${stt.getProvider()} async transcription for ${transcriptionId}...`,
      );

      let sttTranscriptionId: string;

      // Check if we need to upload the file directly (local storage)
      if (audioUrl.startsWith("file://") || isBuffer) {
        // Get the file buffer and filename
        const fileBuffer = isBuffer ? file : await storage.getFileBuffer(file);
        const transcription = await prisma.transcription.findUnique({
          where: { id: transcriptionId },
          select: { audioFileName: true },
        });

        const result = await stt.transcribeFromFileAsync({
          fileBuffer,
          fileName: transcription?.audioFileName || "audio.mp3",
          language: options.language,
          speakerCount: options.speakerCount,
          vocabulary: options.vocabulary,
          tagAudioEvents: options.tagAudioEvents,
        });

        sttTranscriptionId = result.transcriptionId;
      } else {
        // Use URL-based transcription (S3 or other cloud storage)
        const result = await stt.transcribeFromUrlAsync({
          audioUrl,
          language: options.language,
          speakerCount: options.speakerCount,
          vocabulary: options.vocabulary,
          tagAudioEvents: options.tagAudioEvents,
        });

        sttTranscriptionId = result.transcriptionId;
      }

      // Store the STT transcription ID
      await prisma.transcription.update({
        where: { id: transcriptionId },
        data: {
          elevenLabsTranscriptionId: sttTranscriptionId,
        },
      });

      console.log(
        `Transcription job started for ${transcriptionId} with ${stt.getProvider()} ID: ${sttTranscriptionId}`,
      );
    } else {
      // Use simulated transcription for development
      console.log(`Simulating transcription for ${transcriptionId}...`);

      // Simulate async processing
      const result = await stt.simulateTranscription(
        {
          audioUrl,
          language: options.language,
          speakerCount: options.speakerCount,
          vocabulary: options.vocabulary,
          tagAudioEvents: options.tagAudioEvents,
        },
        options.duration,
      );

      // Save the transcription result
      await prisma.transcription.update({
        where: { id: transcriptionId },
        data: {
          state: "COMPLETED",
          transcription: result as never,
          speakers: (parseSpeakers(result) ?? null) as never,
          completedAt: new Date(),
        },
      });

      console.log(`Simulated transcription completed for ${transcriptionId}`);
    }
  } catch (error) {
    console.error(`Error processing transcription ${transcriptionId}:`, error);

    // Update transcription with error
    await prisma.transcription.update({
      where: { id: transcriptionId },
      data: {
        state: "ERROR",
        errorMessage:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
    });
  }
}
