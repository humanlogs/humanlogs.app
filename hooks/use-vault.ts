/**
 * This hook will expose functions used to encrypt and decrypt data
 * Uses AES-GCM encryption for secure client-side encryption
 */

const keys: { [keyHash: string]: CryptoKey } = {};
let primaryKeyHash = "";

/**
 * Generate a SHA-256 hash of the public key identifier
 */
async function hashPublicKey(publicKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(publicKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Derive a CryptoKey from a password/private key using PBKDF2
 */
async function deriveKey(
  privateKey: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(privateKey),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Convert ArrayBuffer to Base64 string
 */
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert Base64 string to Uint8Array
 */
function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export const useVault = () => {
  const loadKey = async (
    publicKey: string,
    privateKey: string,
  ): Promise<void> => {
    const keyHash = await hashPublicKey(publicKey);

    // Use a fixed salt derived from the public key for deterministic key derivation
    const saltString = `vault-salt-${publicKey}`;
    const encoder = new TextEncoder();
    const saltData = encoder.encode(saltString);
    const saltHashBuffer = await crypto.subtle.digest("SHA-256", saltData);
    const salt = new Uint8Array(saltHashBuffer);

    const cryptoKey = await deriveKey(privateKey, salt);
    keys[keyHash] = cryptoKey;
  };

  const setPrimaryKey = async (publicKey: string): Promise<void> => {
    primaryKeyHash = await hashPublicKey(publicKey);

    if (!keys[primaryKeyHash]) {
      throw new Error(
        `Primary key "${publicKey}" not loaded. Call loadKey first.`,
      );
    }
  };

  const decrypt = async <T>(encryptedData: string): Promise<T> => {
    // Format: "vault:v1:{publicKeyHash}:{encryptedJsonPayload}"
    const parts = encryptedData.split(":");

    if (parts.length !== 4 || parts[0] !== "vault" || parts[1] !== "v1") {
      throw new Error("Invalid encrypted data format");
    }

    const keyHash = parts[2];
    const encryptedPayload = parts[3];

    const cryptoKey = keys[keyHash];
    if (!cryptoKey) {
      throw new Error(`Decryption key not found for hash: ${keyHash}`);
    }

    // Decode the base64 payload
    const encryptedBuffer = base64ToBuffer(encryptedPayload);

    // Extract IV (first 12 bytes) and ciphertext
    const iv = encryptedBuffer.slice(0, 12);
    const ciphertext = encryptedBuffer.slice(12);

    // Decrypt
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      ciphertext,
    );

    // Convert to string and parse JSON
    const decoder = new TextDecoder();
    const decryptedString = decoder.decode(decryptedBuffer);
    return JSON.parse(decryptedString) as T;
  };

  // This will be used for audio files
  const decryptBuffer = async (
    encryptedBuffer: ArrayBuffer,
  ): Promise<ArrayBuffer> => {
    if (!primaryKeyHash || !keys[primaryKeyHash]) {
      throw new Error("Primary key not set or not loaded");
    }

    const cryptoKey = keys[primaryKeyHash];
    const encryptedArray = new Uint8Array(encryptedBuffer);

    // Extract IV (first 12 bytes) and ciphertext
    const iv = encryptedArray.slice(0, 12);
    const ciphertext = encryptedArray.slice(12);

    // Decrypt
    return crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      ciphertext,
    );
  };

  const encrypt = async <T>(data: T): Promise<string> => {
    if (!primaryKeyHash || !keys[primaryKeyHash]) {
      throw new Error("Primary key not set or not loaded");
    }

    const cryptoKey = keys[primaryKeyHash];

    // Convert data to JSON string
    const jsonString = JSON.stringify(data);
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(jsonString);

    // Generate random IV (12 bytes for AES-GCM)
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt
    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      dataBuffer,
    );

    // Combine IV and ciphertext
    const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encryptedBuffer), iv.length);

    // Convert to base64
    const base64Payload = bufferToBase64(combined.buffer);

    // Return formatted string: "vault:v1:{publicKeyHash}:{encryptedJsonPayload}"
    return `vault:v1:${primaryKeyHash}:${base64Payload}`;
  };

  const encryptBuffer = async (buffer: ArrayBuffer): Promise<ArrayBuffer> => {
    if (!primaryKeyHash || !keys[primaryKeyHash]) {
      throw new Error("Primary key not set or not loaded");
    }

    const cryptoKey = keys[primaryKeyHash];

    // Generate random IV (12 bytes for AES-GCM)
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt
    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      buffer,
    );

    // Combine IV and ciphertext
    const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encryptedBuffer), iv.length);

    return combined.buffer;
  };

  return {
    loadKey,
    setPrimaryKey,
    decrypt,
    decryptBuffer,
    encrypt,
    encryptBuffer,
  };
};
