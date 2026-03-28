/**
 * Server-side vault encryption utilities
 * Mirrors the client-side vault format: vault:v1:{publicKeyHash}:{encryptedPayload}
 * Uses AES-GCM encryption with keys derived from public/private key pairs
 */

import crypto from "crypto";

/**
 * Generate a SHA-256 hash of the public key identifier
 */
export async function hashPublicKey(publicKey: string): Promise<string> {
  const hash = crypto.createHash("sha256");
  hash.update(publicKey);
  return hash.digest("hex");
}

/**
 * Derive a crypto key from a private key using PBKDF2
 */
function deriveKey(privateKey: string, publicKey: string): Buffer {
  const salt = crypto
    .createHash("sha256")
    .update(`vault-salt-${publicKey}`)
    .digest();

  return crypto.pbkdf2Sync(
    privateKey,
    salt,
    100000, // iterations
    32, // key length (256 bits)
    "sha256",
  );
}

/**
 * Encrypt data using the vault format
 * Returns: "vault:v1:{publicKeyHash}:{encryptedPayload}"
 */
export async function vaultEncrypt(
  data: any,
  publicKey: string,
  privateKey: string,
): Promise<string> {
  const keyHash = await hashPublicKey(publicKey);
  const cryptoKey = deriveKey(privateKey, publicKey);

  // Convert data to JSON string
  const jsonString = JSON.stringify(data);

  // Generate random IV (12 bytes for AES-GCM)
  const iv = crypto.randomBytes(12);

  // Create cipher
  const cipher = crypto.createCipheriv("aes-256-gcm", cryptoKey, iv);

  // Encrypt
  const encrypted = Buffer.concat([
    cipher.update(jsonString, "utf8"),
    cipher.final(),
  ]);

  // Get auth tag
  const authTag = cipher.getAuthTag();

  // Combine IV + encrypted data + auth tag
  const combined = Buffer.concat([iv, encrypted, authTag]);

  // Convert to base64
  const base64Payload = combined.toString("base64");

  // Return formatted string: "vault:v1:{publicKeyHash}:{encryptedPayload}"
  return `vault:v1:${keyHash}:${base64Payload}`;
}

/**
 * Decrypt data from the vault format
 * Input: "vault:v1:{publicKeyHash}:{encryptedPayload}"
 */
export async function vaultDecrypt<T>(
  encryptedData: string,
  publicKey: string,
  privateKey: string,
): Promise<T> {
  const parts = encryptedData.split(":");

  if (parts.length !== 4 || parts[0] !== "vault" || parts[1] !== "v1") {
    throw new Error("Invalid encrypted data format");
  }

  const keyHash = parts[2];
  const expectedKeyHash = await hashPublicKey(publicKey);

  if (keyHash !== expectedKeyHash) {
    throw new Error(
      `Key hash mismatch. Expected: ${expectedKeyHash}, got: ${keyHash}`,
    );
  }

  const encryptedPayload = parts[3];
  const cryptoKey = deriveKey(privateKey, publicKey);

  // Decode the base64 payload
  const combinedBuffer = Buffer.from(encryptedPayload, "base64");

  // Extract IV (first 12 bytes), ciphertext, and auth tag (last 16 bytes)
  const iv = combinedBuffer.slice(0, 12);
  const authTag = combinedBuffer.slice(-16);
  const ciphertext = combinedBuffer.slice(12, -16);

  // Create decipher
  const decipher = crypto.createDecipheriv("aes-256-gcm", cryptoKey, iv);
  decipher.setAuthTag(authTag);

  // Decrypt
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  // Parse JSON
  const decryptedString = decrypted.toString("utf8");
  return JSON.parse(decryptedString) as T;
}

/**
 * Check if a value is encrypted (matches vault format for strings)
 */
export function isVaultEncrypted(value: any): boolean {
  if (typeof value === "string") {
    return value.startsWith("vault:v1:");
  }

  if (typeof value === "object" && value !== null && "encrypted" in value) {
    return (
      typeof value.encrypted === "string" &&
      value.encrypted.startsWith("vault:v1:")
    );
  }

  return false;
}

/**
 * Encrypt a string field
 * Returns: "vault:v1:{publicKeyHash}:{encryptedPayload}"
 */
export async function encryptStringField(
  value: string,
  publicKey: string,
  privateKey: string,
): Promise<string> {
  return vaultEncrypt(value, publicKey, privateKey);
}

/**
 * Encrypt a JSON field
 * Returns: {encrypted: "vault:v1:{publicKeyHash}:{encryptedPayload}"}
 */
export async function encryptJsonField(
  value: any,
  publicKey: string,
  privateKey: string,
): Promise<{ encrypted: string }> {
  const encrypted = await vaultEncrypt(value, publicKey, privateKey);
  return { encrypted };
}

/**
 * Decrypt a string field
 */
export async function decryptStringField(
  encryptedValue: string,
  publicKey: string,
  privateKey: string,
): Promise<string> {
  return vaultDecrypt<string>(encryptedValue, publicKey, privateKey);
}

/**
 * Decrypt a JSON field
 */
export async function decryptJsonField<T>(
  encryptedValue: { encrypted: string } | any,
  publicKey: string,
  privateKey: string,
): Promise<T> {
  if (
    typeof encryptedValue === "object" &&
    encryptedValue !== null &&
    "encrypted" in encryptedValue
  ) {
    return vaultDecrypt<T>(encryptedValue.encrypted, publicKey, privateKey);
  }
  // If not encrypted, return as-is
  return encryptedValue as T;
}
