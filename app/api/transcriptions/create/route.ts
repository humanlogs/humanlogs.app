import {
  checkFfmpegAvailable,
  compressAudio,
  encryptAudioBuffer,
} from "@/lib/audio/audio-processing";
import { getSTTService } from "@/lib/stt/stt-service";
import { prisma } from "@/lib/prisma";
import { generateAudioKey, getStorage } from "@/lib/storage";
import { isBillableVersion } from "@/lib/billing/stripe";
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { EncryptionUtils } from "../../../../lib/encryption/encryption-entities";
import { withAuthRateLimit } from "@/lib/router/rate-limit-middleware";

export const dynamic = "force-dynamic";

// Maximum file size: 1GB
const MAX_FILE_SIZE = 1024 * 1024 * 1024;

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
  try {
    // Parse multipart form data
    const formData = await request.formData();

    // Extract form fields
    const language = (formData.get("language") as string) || "en";
    const speakerCount = parseInt(
      (formData.get("speakerCount") as string) || "2",
      10,
    );
    const vocabulary = (formData.get("vocabulary") as string) || "";
    const vocabularyArray = vocabulary
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

    // Extract audio files
    const audioFiles: File[] = [];
    const fileNames: string[] = [];
    const fileDurations: number[] = [];

    let index = 0;
    while (true) {
      const file = formData.get(`file_${index}`) as File;
      const fileName = formData.get(`fileName_${index}`) as string;
      const duration = formData.get(`duration_${index}`) as string;

      if (!file) break;

      audioFiles.push(file);
      fileNames.push(fileName || file.name);
      fileDurations.push(parseFloat(duration || "0"));
      index++;
    }

    // Validation
    if (audioFiles.length === 0) {
      return NextResponse.json(
        { error: "At least one audio file is required" },
        { status: 400 },
      );
    }

    // Validate file sizes and types
    for (const file of audioFiles) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File ${file.name} exceeds maximum size of 1GB` },
          { status: 400 },
        );
      }

      if (
        !SUPPORTED_FORMATS.includes(file.type) &&
        !file.name.match(
          /\.(mp3|wav|m4a|flac|aac|ogg|opus|wma|aiff|mp4|mov|avi|mkv|webm|flv|wmv|mpeg|mpg|3gp)$/i,
        )
      ) {
        return NextResponse.json(
          { error: `File ${file.name} has unsupported format` },
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
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const availableCredits = userProfile.credits;
      if (availableCredits < creditsNeeded) {
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
    const audioBuffers: Buffer[] = [];

    try {
      // Create all transcription records first
      for (let i = 0; i < audioFiles.length; i++) {
        const file = audioFiles[i];
        const fileName = fileNames[i];

        // Create transcription record
        const transcription = await prisma.transcription.create({
          data: {
            userId: user.id,
            title: fileName,
            audioFileName: fileName,
            audioFileSize: file.size,
            audioFileKey: "", // Will be updated after upload in async processing
            language,
            speakerCount,
            vocabulary: vocabularyArray,
            state: "PENDING",
          },
        });

        createdTranscriptions.push(transcription.id);

        // Get original file buffer
        const originalBuffer = Buffer.from(await file.arrayBuffer());
        audioBuffers.push(originalBuffer);
      }

      // Deduct credits only if billable version
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

      // Start async processing for all files (compression, encryption, upload, transcription)
      // We don't await this to return the response immediately
      for (let i = 0; i < audioFiles.length; i++) {
        const transcriptionId = createdTranscriptions[i];
        const originalBuffer = audioBuffers[i];
        const fileName = fileNames[i];
        const duration = fileDurations[i];

        processAudioAndTranscription(
          transcriptionId,
          originalBuffer,
          fileName,
          user.id,
          {
            language,
            speakerCount,
            vocabulary: vocabularyArray,
            duration,
          },
        ).catch((error) => {
          console.error(
            `Error processing audio and transcription ${transcriptionId}:`,
            error,
          );
        });
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
  originalBuffer: Buffer,
  fileName: string,
  userId: string,
  options: {
    language: string;
    speakerCount: number;
    vocabulary: string[];
    duration: number;
  },
): Promise<void> {
  try {
    const storage = getStorage();

    // Compress audio file using ffmpeg
    let unencryptedFile: Buffer;
    try {
      const ffmpegAvailable = await checkFfmpegAvailable();
      if (ffmpegAvailable) {
        console.log(
          `Compressing audio file ${fileName} (${originalBuffer.length} bytes)...`,
        );
        unencryptedFile = await compressAudio(originalBuffer, fileName);
        console.log(
          `Compressed to ${unencryptedFile.length} bytes (${Math.round((unencryptedFile.length / originalBuffer.length) * 100)}% of original)`,
        );
      } else {
        console.warn(
          "ffmpeg not available, skipping compression. Install ffmpeg for optimal storage.",
        );
        unencryptedFile = originalBuffer;
      }
    } catch (error) {
      console.error("Error compressing audio, using original:", error);
      unencryptedFile = originalBuffer;
    }

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
    duration: number;
  },
): Promise<void> {
  try {
    const storage = getStorage();
    const stt = getSTTService();

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
        });

        sttTranscriptionId = result.transcriptionId;
      } else {
        // Use URL-based transcription (S3 or other cloud storage)
        const result = await stt.transcribeFromUrlAsync({
          audioUrl,
          language: options.language,
          speakerCount: options.speakerCount,
          vocabulary: options.vocabulary,
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
        },
        options.duration,
      );

      // Save the transcription result
      await prisma.transcription.update({
        where: { id: transcriptionId },
        data: {
          state: "COMPLETED",
          transcription: result as never,
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
