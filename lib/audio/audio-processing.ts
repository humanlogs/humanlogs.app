/**
 * Audio processing utilities for compression and encryption
 */

import { exec } from "child_process";
import { promisify } from "util";
import { unlink, stat } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import crypto from "crypto";

const execAsync = promisify(exec);

const MAX_COMPRESSED_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Compress an audio/video file (already on disk) to opus using ffmpeg.
 *
 * Reads the input straight from disk and writes the compressed opus to a new
 * temp file, so the large source is never held in RAM. Returns the path to the
 * compressed file; the caller owns both `inputPath` and the returned path and
 * is responsible for deleting them.
 *
 * Target: Max 50MB for a 2h file (~30MB).
 */
export async function compressAudioFile(inputPath: string): Promise<string> {
  const tmpDir = tmpdir();
  const randomId = crypto.randomBytes(16).toString("hex");
  const outputPath = join(tmpDir, `output-${randomId}.opus`);

  console.log(`Starting ffmpeg compression for ${inputPath}`);

  try {
    // Compress using ffmpeg with opus codec at 32k bitrate
    // -i: input file
    // -c:a libopus: use opus audio codec
    // -b:a 32k: set audio bitrate to 32 kbps
    // -vn: no video
    // -y: overwrite output file
    // -loglevel error: only show errors to reduce buffer usage
    const ffmpegCommand = `ffmpeg -i "${inputPath}" -c:a libopus -b:a 32k -vn -loglevel error -y "${outputPath}"`;

    console.log(`Running ffmpeg command: ${ffmpegCommand}`);

    await execAsync(ffmpegCommand, {
      maxBuffer: 100 * 1024 * 1024, // 100MB buffer for stderr (needed for large files)
      timeout: 600000, // 10 minute timeout for very large files
    });

    let { size } = await stat(outputPath);
    console.log(`Compression complete: ${size} bytes`);

    // Verify size is within limits
    if (size > MAX_COMPRESSED_SIZE) {
      console.warn(
        `Compressed file (${size} bytes) exceeds 50MB limit. Adjusting bitrate...`,
      );

      // Try with lower bitrate
      const lowerBitrateCommand = `ffmpeg -i "${inputPath}" -c:a libopus -b:a 24k -vn -loglevel error -y "${outputPath}"`;
      await execAsync(lowerBitrateCommand, {
        maxBuffer: 100 * 1024 * 1024,
        timeout: 600000,
      });

      ({ size } = await stat(outputPath));
      console.log(`Recompression complete: ${size} bytes`);
    }

    return outputPath;
  } catch (error) {
    console.error(`FFmpeg compression failed for ${inputPath}:`, error);
    // Best-effort cleanup of a partial output; the input is owned by the caller.
    await unlink(outputPath).catch(() => {});
    throw error;
  }
}

/**
 * Encrypt audio buffer using AES-256-GCM with a transcription encryption key
 * Returns encrypted buffer with format: [IV (12 bytes)][Auth Tag (16 bytes)][Encrypted Data]
 */
export function encryptAudioBuffer(
  buffer: Buffer,
  transcriptionEncryptionKey: string,
): Buffer {
  // The transcription encryption key is already a base64-encoded 256-bit key
  const key = Buffer.from(transcriptionEncryptionKey, "base64");

  // Generate random IV (12 bytes for GCM)
  const iv = crypto.randomBytes(12);

  // Create cipher
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  // Encrypt the buffer
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);

  // Get auth tag
  const authTag = cipher.getAuthTag();

  // Combine IV + Auth Tag + Encrypted Data
  return Buffer.concat([iv, authTag, encrypted]);
}

/**
 * Decrypt audio buffer using AES-256-GCM with a transcription encryption key
 * Expects format: [IV (12 bytes)][Auth Tag (16 bytes)][Encrypted Data]
 */
export function decryptAudioBuffer(
  encryptedBuffer: Buffer,
  transcriptionEncryptionKey: string,
): Buffer {
  // The transcription encryption key is a base64-encoded 256-bit key
  const key = Buffer.from(transcriptionEncryptionKey, "base64");

  // Extract IV, auth tag, and encrypted data
  const iv = encryptedBuffer.subarray(0, 12);
  const authTag = encryptedBuffer.subarray(12, 28);
  const encrypted = encryptedBuffer.subarray(28);

  // Create decipher
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  // Decrypt
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

/**
 * Check if ffmpeg is available
 */
export async function checkFfmpegAvailable(): Promise<boolean> {
  try {
    await execAsync("ffmpeg -version");
    return true;
  } catch {
    return false;
  }
}
