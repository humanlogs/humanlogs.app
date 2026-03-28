import {
  checkFfmpegAvailable,
  compressAudio,
  encryptAudioBuffer,
  generateTranscriptionEncryptionKey,
  encryptTranscriptionKey,
} from "@/lib/audio-processing";
import { requireAuth } from "@/lib/auth-helpers";
import { getElevenLabsClient, isElevenLabsConfigured } from "@/lib/elevenlabs";
import { prisma } from "@/lib/prisma";
import { generateAudioKey, getStorage } from "@/lib/storage";
import { isBillableVersion } from "@/lib/stripe";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Maximum file size: 500MB
const MAX_FILE_SIZE = 500 * 1024 * 1024;

// Supported audio formats
const SUPPORTED_FORMATS = [
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/x-m4a",
  "audio/flac",
];

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

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
          { error: `File ${file.name} exceeds maximum size of 500MB` },
          { status: 400 },
        );
      }

      if (
        !SUPPORTED_FORMATS.includes(file.type) &&
        !file.name.match(/\.(mp3|wav|m4a|flac)$/i)
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

    // Process each file and create transcriptions
    const storage = getStorage();
    const createdTranscriptions: string[] = [];

    try {
      for (let i = 0; i < audioFiles.length; i++) {
        const file = audioFiles[i];
        const fileName = fileNames[i];
        const duration = fileDurations[i];

        // Create transcription record first
        const transcription = await prisma.transcription.create({
          data: {
            userId: user.id,
            title: fileName,
            audioFileName: fileName,
            audioFileSize: file.size,
            audioFileKey: "", // Will be updated after upload
            language,
            speakerCount,
            vocabulary: vocabularyArray,
            state: "PENDING",
          },
        });

        createdTranscriptions.push(transcription.id);

        // Get original file buffer
        const originalBuffer = Buffer.from(await file.arrayBuffer());

        // Compress audio file using ffmpeg
        let unencryptedFile: Buffer;
        try {
          const ffmpegAvailable = await checkFfmpegAvailable();
          if (ffmpegAvailable) {
            console.log(
              `Compressing audio file ${fileName} (${file.size} bytes)...`,
            );
            unencryptedFile = await compressAudio(originalBuffer, fileName);
            console.log(
              `Compressed to ${unencryptedFile.length} bytes (${Math.round((unencryptedFile.length / file.size) * 100)}% of original)`,
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

        // Check if user has encryption enabled
        const userWithKey = await prisma.user.findUnique({
          where: { id: user.id },
          select: { publicKey: true },
        });

        // Generate a unique encryption key for this transcription
        let transcriptionEncryptionKey: string | null = null;
        let fileToStore: Buffer;
        let contentType: string;

        if (userWithKey?.publicKey) {
          // Generate random encryption key for this transcription
          transcriptionEncryptionKey = generateTranscriptionEncryptionKey();

          console.log(`Encrypting file for transcription ${transcription.id}...`);

          // Encrypt the audio file with the transcription key
          fileToStore = encryptAudioBuffer(
            unencryptedFile,
            transcriptionEncryptionKey,
          );
          contentType = "application/octet-stream"; // Encrypted binary data

          // Encrypt the transcription key with the user's public key
          const encryptedEncryptionKey = encryptTranscriptionKey(
            transcriptionEncryptionKey,
            userWithKey.publicKey,
          );

          // Store the encrypted encryption key
          await prisma.transcriptionEncryptionKey.create({
            data: {
              transcriptionId: transcription.id,
              userId: user.id,
              encryptedEncryptionKey,
            },
          });

          console.log(`Encrypted file size: ${fileToStore.length} bytes`);
        } else {
          fileToStore = unencryptedFile;
          contentType = "audio/opus"; // Compressed opus file
        }

        // Upload to storage
        const storageKey = generateAudioKey(
          user.id,
          transcription.id,
          file.name,
        );
        await storage.upload(storageKey, fileToStore, contentType);

        // Update transcription with storage key
        await prisma.transcription.update({
          where: { id: transcription.id },
          data: { audioFileKey: storageKey },
        });

        // Start transcription job asynchronously
        // We don't await this to avoid blocking the response
        // Pass the unencrypted file to the transcription process
        processTranscription(transcription.id, unencryptedFile, {
          language,
          speakerCount,
          vocabulary: vocabularyArray,
          duration,
        }).catch((error) => {
          console.error(
            `Error processing transcription ${transcription.id}:`,
            error,
          );
        });
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
    const elevenLabs = getElevenLabsClient();

    const isBuffer = Buffer.isBuffer(file);

    // Get audio URL or file path
    const audioUrl = isBuffer ? "" : await storage.getUrl(file, 7200); // 2 hours

    if (isElevenLabsConfigured()) {
      // Use real ElevenLabs API (async)
      console.log(
        `Starting ElevenLabs async transcription for ${transcriptionId}...`,
      );

      let elevenLabsTranscriptionId: string;

      // Check if we need to upload the file directly (local storage)
      if (audioUrl.startsWith("file://") || isBuffer) {
        // Get the file buffer and filename
        const fileBuffer = isBuffer ? file : await storage.getFileBuffer(file);
        const transcription = await prisma.transcription.findUnique({
          where: { id: transcriptionId },
          select: { audioFileName: true },
        });

        const result = await elevenLabs.transcribeFromFileAsync({
          fileBuffer,
          fileName: transcription?.audioFileName || "audio.mp3",
          language: options.language,
          speakerCount: options.speakerCount,
          vocabulary: options.vocabulary,
        });

        elevenLabsTranscriptionId = result.transcriptionId;
      } else {
        // Use URL-based transcription (S3 or other cloud storage)
        const result = await elevenLabs.transcribeFromUrlAsync({
          audioUrl,
          language: options.language,
          speakerCount: options.speakerCount,
          vocabulary: options.vocabulary,
        });

        elevenLabsTranscriptionId = result.transcriptionId;
      }

      // Store the ElevenLabs transcription ID
      await prisma.transcription.update({
        where: { id: transcriptionId },
        data: {
          elevenLabsTranscriptionId,
        },
      });

      console.log(
        `Transcription job started for ${transcriptionId} with ElevenLabs ID: ${elevenLabsTranscriptionId}`,
      );
    } else {
      // Use simulated transcription for development
      console.log(`Simulating transcription for ${transcriptionId}...`);

      // Simulate async processing
      const result = await elevenLabs.simulateTranscription(
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
