import crypto from "crypto";

// Encryption utilities for secure file storage
export function generateEncryptionKey(): Buffer {
  return crypto.randomBytes(32); // 256-bit key for AES-256
}

export function encryptBuffer(
  buffer: Buffer,
  key: Buffer,
): { encrypted: Buffer; iv: Buffer } {
  const iv = crypto.randomBytes(16); // 128-bit IV
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return { encrypted, iv };
}

// Re-use the decrypt function from gladia.ts
export function decryptBuffer(
  encrypted: Buffer,
  key: Buffer,
  iv: Buffer,
): Buffer {
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}
