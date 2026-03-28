/**
 *
 * We have two concepts:
 *
 * EncryptedAccessorEntity: This is the users that can access the encrypted data
 * - publicKey: a public key, usable to encrypt data for this user
 * - publicKeyHash: a hash of the public key, used to identify the key without exposing it directly
 *
 * EncryptedDataEntity: This is the encrypted data stored in the database, it can be any JSON object
 * {
 *   "version": "v1",
 *   "privateKeys": [
 *     {
 *        "userId": "User ID that can access this data",
 *        "publicKey": "Public key of the user",
 *        "publicKeyHash": "Hash of the public key for identification",
 *        "aesKeyEncrypted": "Encrypted AES key used to decrypt/encrypt the data"
 *     }
 *   ],
 *   "payload": "The actual encrypted data (encrypted with AES key)"
 * }
 *
 * To encrypt: Generate a fresh AES key, encrypt the data, then encrypt the AES key for each user.
 * To decrypt: Use your private key to decrypt the AES key, then decrypt the payload.
 * This way, we can share the same encrypted data with multiple users without duplicating it,
 * and we can revoke access by simply removing the corresponding entry.
 *
 */

// Crypto interface for both Node.js and browser compatibility
export interface CryptoCompat {
  createHash(algorithm: string): {
    update(data: string): void;
    digest(encoding: string): Promise<string> | string;
  };
  publicEncrypt(
    options: { key: string; padding: number; oaepHash: string },
    buffer: Buffer | Uint8Array,
  ): Promise<Buffer | Uint8Array> | Buffer | Uint8Array;
  privateDecrypt(
    options: { key: string; padding: number; oaepHash: string },
    buffer: Buffer | Uint8Array,
  ): Promise<Buffer | Uint8Array> | Buffer | Uint8Array;
  randomBytes(size: number): Buffer | Uint8Array;
  createCipheriv(
    algorithm: string,
    key: Buffer | Uint8Array,
    iv: Buffer | Uint8Array,
  ): {
    update(
      data: string | Buffer | Uint8Array,
      inputEncoding?: string,
    ): Promise<Buffer | Uint8Array> | Buffer | Uint8Array;
    final(): Promise<Buffer | Uint8Array> | Buffer | Uint8Array;
    getAuthTag(): Buffer | Uint8Array;
  };
  createDecipheriv(
    algorithm: string,
    key: Buffer | Uint8Array,
    iv: Buffer | Uint8Array,
  ): {
    setAuthTag(tag: Buffer | Uint8Array): void;
    update(
      data: Buffer | Uint8Array,
    ): Promise<Buffer | Uint8Array> | Buffer | Uint8Array;
    final(): Promise<Buffer | Uint8Array> | Buffer | Uint8Array;
  };
  constants: {
    RSA_PKCS1_OAEP_PADDING: number;
  };
  // Helper to convert buffer to string (handles both Node.js Buffer and Uint8Array)
  bufferToString?: (buffer: Buffer | Uint8Array, encoding: string) => string;
}

// ========================
// Type Definitions
// ========================

export type EncryptedAccessorEntity = {
  userId: string;
  publicKey: string; // PEM format
};

export type EncryptedDataEntity = {
  version: "v1";
  privateKeys: Array<{
    userId: string;
    publicKey: string; // PEM format
    aesKeyEncrypted: string; // AES key encrypted with user's public key
  }>;
  payload: string; // Encrypted data (encrypted with AES key)
};

// ========================
// Helper Functions
// ========================

/**
 * Creates a SHA-256 hash of a public key.
 */
export class EncryptionUtils {
  constructor(private crypto: CryptoCompat) {}

  /**
   * Helper to convert buffer to string (handles both Node.js Buffer and Uint8Array)
   */
  private bufferToString(
    buffer: Buffer | Uint8Array,
    encoding: string,
  ): string {
    if (this.crypto.bufferToString) {
      return this.crypto.bufferToString(buffer, encoding);
    }
    // Fallback for Node.js Buffer
    return (buffer as any).toString(encoding);
  }

  public async hashPublicKey(publicKeyPem: string): Promise<string> {
    const hash = this.crypto.createHash("sha256");
    hash.update(publicKeyPem);
    return await hash.digest("hex");
  }

  /**
   * Encrypt a transcription encryption key with a user's RSA public key
   * Returns encrypted key in base64 format
   */
  public async encryptStringWithPublicKey(
    transcriptionKey: string,
    userPublicKeyPem: string,
  ): Promise<string> {
    // Encrypt the transcription key using RSA-OAEP
    const encrypted = await this.crypto.publicEncrypt(
      {
        key: userPublicKeyPem,
        padding: this.crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(transcriptionKey, "utf8"),
    );

    return this.bufferToString(encrypted as any, "base64");
  }

  /**
   * Decrypt a transcription encryption key with a user's RSA private key
   */
  public async decryptStringWithPrivateKey(
    encryptedKey: string,
    userPrivateKeyPem: string,
  ): Promise<string> {
    // Decrypt the transcription key using RSA-OAEP
    const decrypted = await this.crypto.privateDecrypt(
      {
        key: userPrivateKeyPem,
        padding: this.crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(encryptedKey, "base64"),
    );

    return this.bufferToString(decrypted as any, "utf8");
  }

  public async createEncryptedAccessorEntity(
    userId: string,
    publicKeyPem: string,
  ): Promise<EncryptedAccessorEntity> {
    return {
      userId,
      publicKey: publicKeyPem,
    };
  }

  /**
   * Generates a random AES-256 key and returns it as base64 string.
   */
  generateAESKeySync(): string {
    return this.bufferToString(this.crypto.randomBytes(32), "base64");
  }

  /**
   * Encrypts data using AES-256-GCM with a base64-encoded key.
   */
  async encryptWithAESKeySync(
    data: string,
    aesKeyBase64: string,
  ): Promise<string> {
    const key = Buffer.from(aesKeyBase64, "base64");
    const iv = this.crypto.randomBytes(12);
    const cipher = this.crypto.createCipheriv("aes-256-gcm", key, iv);

    const encrypted = Buffer.concat([
      await cipher.update(data, "utf8"),
      await cipher.final(),
    ] as any);
    const authTag = cipher.getAuthTag();

    // Combine iv + authTag + encrypted data
    const combined = Buffer.concat([iv as any, authTag as any, encrypted]);
    return this.bufferToString(combined, "base64");
  }

  /**
   * Decrypts data using AES-256-GCM with a base64-encoded key.
   */
  async decryptWithAESKeySync(
    encryptedDataBase64: string,
    aesKeyBase64: string,
  ): Promise<string> {
    const key = Buffer.from(aesKeyBase64, "base64");
    const combined = Buffer.from(encryptedDataBase64, "base64");

    const iv = combined.subarray(0, 12);
    const authTag = combined.subarray(12, 28);
    const encrypted = combined.subarray(28);

    const decipher = this.crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      await decipher.update(encrypted),
      await decipher.final(),
    ] as any);

    return this.bufferToString(decrypted, "utf8");
  }

  // ========================
  // Main API Functions
  // ========================

  /**
   * Creates a new encrypted data entity.
   * Use this when creating a new encrypted resource.
   *
   * @param data - The data to encrypt (will be JSON stringified)
   * @param accessors - Users who should have access to decrypt this data
   * @returns An EncryptedDataEntity that can be stored in the database
   */
  async createEncryptedDataEntity(
    data: unknown,
    accessors: EncryptedAccessorEntity[],
  ): Promise<EncryptedDataEntity> {
    if (!accessors || accessors.length === 0) {
      throw new Error("At least one accessor is required");
    }

    // Generate a fresh AES key
    const aesKey = this.generateAESKeySync();

    // Encrypt the data
    const dataString = JSON.stringify(data);
    const encryptedPayload = await this.encryptWithAESKeySync(
      dataString,
      aesKey,
    );

    // Encrypt the AES key for each accessor using their public key
    const privateKeys = await Promise.all(
      accessors.map(async (accessor) => ({
        userId: accessor.userId,
        publicKey: accessor.publicKey,
        aesKeyEncrypted: await this.encryptStringWithPublicKey(
          aesKey,
          accessor.publicKey,
        ),
      })),
    );

    return {
      version: "v1",
      privateKeys,
      payload: encryptedPayload,
    };
  }

  /**
   * Encrypts new data into an existing encrypted entity.
   * Generates a fresh AES key and re-encrypts it for all accessors.
   * Use this when updating encrypted data.
   *
   * @param encryptedEntity - The existing encrypted data entity (template with accessors)
   * @param data - The new data to encrypt (will be JSON stringified)
   * @returns Updated EncryptedDataEntity with new encrypted payload and fresh AES key
   */
  public async encrypt(
    encryptedEntity: EncryptedDataEntity,
    data: unknown,
  ): Promise<EncryptedDataEntity> {
    if (!encryptedEntity || !encryptedEntity.privateKeys) {
      return data as EncryptedDataEntity; // We don't encrypt
    }

    if (
      (data as EncryptedDataEntity).privateKeys &&
      (data as EncryptedDataEntity).payload
    ) {
      // Data is already an encrypted entity, we should not encrypt it again
      return data as EncryptedDataEntity;
    }

    // Generate a fresh AES key
    const aesKey = this.generateAESKeySync();

    // Encrypt the new data
    const dataString = JSON.stringify(data);
    const encryptedPayload = await this.encryptWithAESKeySync(
      dataString,
      aesKey,
    );

    // Re-encrypt the AES key for each accessor
    const privateKeys = await Promise.all(
      encryptedEntity.privateKeys.map(async (entry) => ({
        userId: entry.userId,
        publicKey: entry.publicKey,
        aesKeyEncrypted: await this.encryptStringWithPublicKey(
          aesKey,
          entry.publicKey,
        ),
      })),
    );

    // Return updated entity with new payload and fresh encrypted keys
    return {
      ...encryptedEntity,
      privateKeys,
      payload: encryptedPayload,
    };
  }

  /**
   * Decrypts an encrypted data entity using the user's private key.
   *
   * @param encryptedEntity - The encrypted data entity
   * @param userPrivateKey - The user's private key (PEM format)
   * @param userPublicKeyHash - The hash of the user's public key
   * @returns The decrypted data
   */
  public async decrypt<T = unknown>(
    encryptedEntity: EncryptedDataEntity,
    userPrivateKey: string,
    userPublicKey: string,
  ): Promise<T> {
    if (typeof encryptedEntity !== "object" || encryptedEntity === null) {
      // If it's not an object, we assume it's not encrypted and return as is
      return encryptedEntity as unknown as T;
    }

    // Automatically handle encrypted part lower in the object structure
    if (!encryptedEntity || !encryptedEntity.privateKeys) {
      const decryptedObject: any = {};
      for (const [key, value] of Object.entries(encryptedEntity as any)) {
        decryptedObject[key] =
          typeof value === "object" && (value as any)?.privateKeys
            ? await this.decrypt(
                value as unknown as EncryptedDataEntity,
                userPrivateKey,
                userPublicKey,
              )
            : value;
      }
      return decryptedObject as T;
    }

    // Find the entry for this user
    const privateKeyEntry = encryptedEntity.privateKeys.find(
      (entry) => entry.publicKey === userPublicKey,
    );

    if (!privateKeyEntry) {
      console.error("Current user entry not found in encrypted entity", {
        encryptedEntity,
        userPublicKey,
      });
      throw new Error("User does not have access to this encrypted data");
    }

    // Decrypt the AES key using the user's private key
    const aesKey = await this.decryptStringWithPrivateKey(
      privateKeyEntry.aesKeyEncrypted,
      userPrivateKey,
    );

    // Decrypt the payload
    const decryptedDataString = await this.decryptWithAESKeySync(
      encryptedEntity.payload,
      aesKey,
    );

    return JSON.parse(decryptedDataString) as T;
  }

  /**
   * Shares access to an encrypted entity with a new user.
   * The current user must have access to decrypt the entity.
   *
   * @param encryptedEntity - The encrypted data entity
   * @param newAccessor - The new user to share with
   * @param currentUserPrivateKey - The current user's private key (PEM format)
   * @param currentUserPublicKeyHash - The hash of the current user's public key
   * @returns Updated EncryptedDataEntity with the new accessor added
   */
  public async share(
    encryptedEntity: EncryptedDataEntity,
    newAccessor: EncryptedAccessorEntity,
    currentUserPrivateKey: string,
    currentUserPublicKey: string,
  ): Promise<EncryptedDataEntity> {
    // Check if the user already has access
    const existingEntry = encryptedEntity.privateKeys.find(
      (entry) => entry.publicKey === newAccessor.publicKey,
    );

    if (existingEntry) {
      // User already has access, return unchanged
      return encryptedEntity;
    }

    // Find the current user's entry
    const currentUserEntry = encryptedEntity.privateKeys.find(
      (entry) => entry.publicKey === currentUserPublicKey,
    );

    if (!currentUserEntry) {
      console.error("Current user entry not found in encrypted entity", {
        encryptedEntity,
        currentUserPublicKey,
      });
      throw new Error(
        "Current user does not have access to this encrypted data",
      );
    }

    // Decrypt the AES key using the current user's private key
    const aesKey = await this.decryptStringWithPrivateKey(
      currentUserEntry.aesKeyEncrypted,
      currentUserPrivateKey,
    );

    // Encrypt the AES key for the new accessor
    const newPrivateKeyEntry = {
      userId: newAccessor.userId,
      publicKey: newAccessor.publicKey,
      aesKeyEncrypted: await this.encryptStringWithPublicKey(
        aesKey,
        newAccessor.publicKey,
      ),
    };

    // Return updated entity with new accessor
    return {
      ...encryptedEntity,
      privateKeys: [...encryptedEntity.privateKeys, newPrivateKeyEntry],
    };
  }

  /**
   * Removes access to an encrypted entity from a user.
   *
   * @param encryptedEntity - The encrypted data entity
   * @param userIdToRemove - The ID of the user to remove
   * @returns Updated EncryptedDataEntity with the user removed
   */
  public unshare(
    encryptedEntity: EncryptedDataEntity,
    userIdToRemove: string,
  ): EncryptedDataEntity {
    const updatedPrivateKeys = encryptedEntity.privateKeys.filter(
      (entry) => entry.userId !== userIdToRemove,
    );

    if (!updatedPrivateKeys?.length) {
      throw new Error(
        "Cannot remove last accessor - at least one user must have access",
      );
    }

    if (updatedPrivateKeys?.length === encryptedEntity.privateKeys?.length) {
      // User not found, return unchanged
      return encryptedEntity;
    }

    return {
      ...encryptedEntity,
      privateKeys: updatedPrivateKeys,
    };
  }
}

// ========================
// Server & Browser Exports
// ========================

// Server-side instance (Node.js crypto)
let serverEncryption: EncryptionUtils | null = null;
if (typeof window === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const crypto = require("crypto");
  serverEncryption = new EncryptionUtils(crypto);
}

export { serverEncryption };

// Browser instance will be exported from a separate file
// Import from '@/lib/encryption-entities.client' for browser use
