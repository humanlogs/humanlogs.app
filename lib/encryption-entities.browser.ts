/**
 * Browser-compatible crypto implementation using Web Crypto API
 */

import { CryptoCompat, EncryptionUtils } from "./encryption-entities";

// Helper to convert PEM to CryptoKey
async function importPublicKeyFromPem(pem: string): Promise<CryptoKey> {
  const pemHeader = "-----BEGIN PUBLIC KEY-----";
  const pemFooter = "-----END PUBLIC KEY-----";
  const pemContents = pem
    .replace(pemHeader, "")
    .replace(pemFooter, "")
    .replace(/\s/g, "");
  const binaryDer = atob(pemContents);
  const binaryDerArray = new Uint8Array(
    Array.from(binaryDer).map((char) => char.charCodeAt(0)),
  );

  return await crypto.subtle.importKey(
    "spki",
    binaryDerArray,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["encrypt"],
  );
}

async function importPrivateKeyFromPem(pem: string): Promise<CryptoKey> {
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = pem
    .replace(pemHeader, "")
    .replace(pemFooter, "")
    .replace(/\s/g, "");
  const binaryDer = atob(pemContents);
  const binaryDerArray = new Uint8Array(
    Array.from(binaryDer).map((char) => char.charCodeAt(0)),
  );

  return await crypto.subtle.importKey(
    "pkcs8",
    binaryDerArray,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["decrypt"],
  );
}

// Simple Buffer-like utilities for Uint8Array
const BrowserBuffer = {
  from(data: string | ArrayBuffer | Uint8Array, encoding?: string): Uint8Array {
    if (typeof data === "string") {
      if (encoding === "base64") {
        const binary = atob(data);
        return Uint8Array.from(binary, (char) => char.charCodeAt(0));
      }
      if (encoding === "utf8" || encoding === "utf-8" || !encoding) {
        return new TextEncoder().encode(data);
      }
    }
    if (data instanceof ArrayBuffer) {
      return new Uint8Array(data);
    }
    if (data instanceof Uint8Array) {
      return new Uint8Array(data);
    }
    throw new Error("Unsupported data type");
  },

  concat(buffers: Uint8Array[]): Uint8Array {
    const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of buffers) {
      result.set(buf, offset);
      offset += buf.length;
    }
    return result;
  },

  toString(buffer: Uint8Array, encoding: string): string {
    if (encoding === "base64") {
      return btoa(String.fromCharCode(...buffer));
    }
    if (encoding === "utf8" || encoding === "utf-8") {
      return new TextDecoder().decode(buffer);
    }
    if (encoding === "hex") {
      return Array.from(buffer)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
    throw new Error(`Unsupported encoding: ${encoding}`);
  },
};

export const browserCrypto: CryptoCompat = {
  createHash(_algorithm: string) {
    let data = "";
    return {
      update(input: string) {
        data += input;
      },
      async digest(encoding: string): Promise<string> {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        if (encoding === "hex") {
          return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
        }
        throw new Error(`Unsupported encoding: ${encoding}`);
      },
    };
  },

  async publicEncrypt(
    options: { key: string; padding: number; oaepHash: string },
    buffer: Uint8Array,
  ): Promise<Uint8Array> {
    const publicKey = await importPublicKeyFromPem(options.key);
    const encrypted = await crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      publicKey,
      (buffer.buffer as ArrayBuffer).slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ),
    );
    return BrowserBuffer.from(encrypted);
  },

  async privateDecrypt(
    options: { key: string; padding: number; oaepHash: string },
    buffer: Uint8Array,
  ): Promise<Uint8Array> {
    const privateKey = await importPrivateKeyFromPem(options.key);
    const decrypted = await crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKey,
      (buffer.buffer as ArrayBuffer).slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ),
    );
    return BrowserBuffer.from(decrypted);
  },

  randomBytes(size: number): Uint8Array {
    const bytes = new Uint8Array(size);
    crypto.getRandomValues(bytes);
    return bytes;
  },

  createCipheriv(_algorithm: string, key: Uint8Array, iv: Uint8Array) {
    let encryptedData: Uint8Array;
    let authTag: Uint8Array;

    return {
      async update(
        data: string | Uint8Array,
        inputEncoding?: string,
      ): Promise<Uint8Array> {
        const dataBuffer =
          typeof data === "string"
            ? BrowserBuffer.from(data, inputEncoding || "utf8")
            : BrowserBuffer.from(data);

        const cryptoKey = await crypto.subtle.importKey(
          "raw",
          (key.buffer as ArrayBuffer).slice(
            key.byteOffset,
            key.byteOffset + key.byteLength,
          ),
          { name: "AES-GCM" },
          false,
          ["encrypt"],
        );

        const encrypted = await crypto.subtle.encrypt(
          {
            name: "AES-GCM",
            iv: (iv.buffer as ArrayBuffer).slice(
              iv.byteOffset,
              iv.byteOffset + iv.byteLength,
            ),
          },
          cryptoKey,
          (dataBuffer.buffer as ArrayBuffer).slice(
            dataBuffer.byteOffset,
            dataBuffer.byteOffset + dataBuffer.byteLength,
          ),
        );

        // AES-GCM in Web Crypto includes auth tag in the output (last 16 bytes)
        const encryptedArray = new Uint8Array(encrypted);
        const dataWithoutTag = encryptedArray.subarray(
          0,
          encryptedArray.length - 16,
        );
        authTag = encryptedArray.subarray(-16);
        encryptedData = dataWithoutTag;

        return dataWithoutTag;
      },
      async final(): Promise<Uint8Array> {
        return new Uint8Array(0);
      },
      getAuthTag(): Uint8Array {
        return authTag;
      },
    };
  },

  createDecipheriv(_algorithm: string, key: Uint8Array, iv: Uint8Array) {
    let authTag: Uint8Array;

    return {
      setAuthTag(tag: Uint8Array): void {
        authTag = tag;
      },
      async update(data: Uint8Array): Promise<Uint8Array> {
        // Combine data with auth tag for Web Crypto API
        const dataWithTag = BrowserBuffer.concat([data, authTag]);

        const cryptoKey = await crypto.subtle.importKey(
          "raw",
          (key.buffer as ArrayBuffer).slice(
            key.byteOffset,
            key.byteOffset + key.byteLength,
          ),
          { name: "AES-GCM" },
          false,
          ["decrypt"],
        );

        const decrypted = await crypto.subtle.decrypt(
          {
            name: "AES-GCM",
            iv: (iv.buffer as ArrayBuffer).slice(
              iv.byteOffset,
              iv.byteOffset + iv.byteLength,
            ),
          },
          cryptoKey,
          (dataWithTag.buffer as ArrayBuffer).slice(
            dataWithTag.byteOffset,
            dataWithTag.byteOffset + dataWithTag.byteLength,
          ),
        );

        return BrowserBuffer.from(decrypted);
      },
      async final(): Promise<Uint8Array> {
        return new Uint8Array(0);
      },
    };
  },

  constants: {
    RSA_PKCS1_OAEP_PADDING: 4, // Node.js constant value
  },

  bufferToString(buffer: Uint8Array, encoding: string): string {
    return BrowserBuffer.toString(buffer, encoding);
  },
};

// Export browser encryption instance
export const browserEncryption = new EncryptionUtils(browserCrypto);
