/**
 * Audio processing utilities for compression and encryption
 */

import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import crypto from "crypto";

const execAsync = promisify(exec);

const MAX_COMPRESSED_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Compress audio file using ffmpeg with opus codec
 * Target: Max 50MB for a 2h file (~30MB)
 */
export async function compressAudio(
  inputBuffer: Buffer,
  originalFileName: string,
): Promise<Buffer> {
  const tmpDir = tmpdir();
  const randomId = crypto.randomBytes(16).toString("hex");
  const inputPath = join(tmpDir, `input-${randomId}-${originalFileName}`);
  const outputPath = join(tmpDir, `output-${randomId}.opus`);

  try {
    // Write input file to temp location
    await writeFile(inputPath, inputBuffer);

    // Compress using ffmpeg with opus codec at 32k bitrate
    // -i: input file
    // -c:a libopus: use opus audio codec
    // -b:a 32k: set audio bitrate to 32 kbps
    // -vn: no video
    // -y: overwrite output file
    const ffmpegCommand = `ffmpeg -i "${inputPath}" -c:a libopus -b:a 32k -vn -y "${outputPath}"`;

    await execAsync(ffmpegCommand, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for stderr
    });

    // Read compressed file
    const compressedBuffer = await readFile(outputPath);

    // Verify size is within limits
    if (compressedBuffer.length > MAX_COMPRESSED_SIZE) {
      console.warn(
        `Compressed file (${compressedBuffer.length} bytes) exceeds 50MB limit. Adjusting bitrate...`,
      );

      // Try with lower bitrate
      const lowerBitrateCommand = `ffmpeg -i "${inputPath}" -c:a libopus -b:a 24k -vn -y "${outputPath}"`;
      await execAsync(lowerBitrateCommand, {
        maxBuffer: 10 * 1024 * 1024,
      });

      const recompressedBuffer = await readFile(outputPath);
      return recompressedBuffer;
    }

    return compressedBuffer;
  } finally {
    // Clean up temp files
    try {
      await unlink(inputPath);
    } catch {
      // Ignore errors
    }
    try {
      await unlink(outputPath);
    } catch {
      // Ignore errors
    }
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
