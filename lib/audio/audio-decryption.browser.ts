/**
 * Browser-compatible audio decryption utilities using Web Crypto API
 */

/**
 * Decrypt audio ArrayBuffer using AES-256-GCM with a transcription encryption key
 * Expects format: [IV (12 bytes)][Auth Tag (16 bytes)][Encrypted Data]
 *
 * @param encryptedBuffer - The encrypted audio data as ArrayBuffer
 * @param transcriptionEncryptionKey - Base64-encoded AES-256 key
 * @returns Decrypted audio data as ArrayBuffer
 */
export async function decryptAudioBuffer(
  encryptedBuffer: ArrayBuffer,
  transcriptionEncryptionKey: string,
): Promise<ArrayBuffer> {
  // The transcription encryption key is a base64-encoded 256-bit key
  const keyData = Uint8Array.from(atob(transcriptionEncryptionKey), (c) =>
    c.charCodeAt(0),
  );

  // Import the AES key
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );

  // Extract IV (12 bytes), auth tag (16 bytes), and encrypted data
  const data = new Uint8Array(encryptedBuffer);
  const iv = data.slice(0, 12);
  const authTag = data.slice(12, 28);
  const encrypted = data.slice(28);

  // Combine encrypted data with auth tag for Web Crypto API
  // (Web Crypto expects auth tag appended to ciphertext)
  const ciphertext = new Uint8Array(encrypted.length + authTag.length);
  ciphertext.set(encrypted, 0);
  ciphertext.set(authTag, encrypted.length);

  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    ciphertext,
  );

  return decrypted;
}

/**
 * Download and decrypt an audio file
 *
 * @param transcriptionId - ID of the transcription
 * @param audioEncryptionKey - Base64-encoded AES-256 key for decrypting the audio
 * @returns Decrypted audio data as Blob
 */
export async function downloadAndDecryptAudio(
  transcriptionId: string,
  audioEncryptionKey: string,
): Promise<Blob> {
  // Fetch the encrypted audio file
  const response = await fetch(`/api/transcriptions/${transcriptionId}/audio`);
  if (!response.ok) {
    throw new Error("Failed to download audio file");
  }

  const encryptedBuffer = await response.arrayBuffer();

  // Decrypt the audio
  const decryptedBuffer = await decryptAudioBuffer(
    encryptedBuffer,
    audioEncryptionKey,
  );

  // Return as Blob
  return new Blob([decryptedBuffer], { type: "audio/opus" });
}
