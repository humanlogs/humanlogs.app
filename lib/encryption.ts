/**
 * End-to-end encryption utilities for secure data storage.
 * Uses Web Crypto API for key generation and encryption.
 */

const ENCRYPTION_STORE_NAME = "encryption-keys";
const DB_NAME = "transcription-storage";
const DB_VERSION = 2; // Increment version for new store

export type EncryptionCertificate = {
  publicKey: string; // PEM format
  privateKey: string; // PEM format
  createdAt: string;
};

/**
 * Opens the IndexedDB database for encryption storage.
 */
function openEncryptionDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create transcriptions store if upgrading from v1
      if (!db.objectStoreNames.contains("transcriptions")) {
        const store = db.createObjectStore("transcriptions", {
          keyPath: "transcriptionId",
        });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }

      // Create encryption store
      if (!db.objectStoreNames.contains(ENCRYPTION_STORE_NAME)) {
        db.createObjectStore(ENCRYPTION_STORE_NAME, {
          keyPath: "key",
        });
      }
    };
  });
}

/**
 * Generates a new RSA key pair for end-to-end encryption.
 */
export async function generateKeyPair(): Promise<{
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"],
  );

  return keyPair;
}

/**
 * Exports a CryptoKey to PEM format.
 */
export async function exportKeyToPem(
  key: CryptoKey,
  type: "public" | "private",
): Promise<string> {
  const exported = await crypto.subtle.exportKey(
    type === "public" ? "spki" : "pkcs8",
    key,
  );
  const exportedAsBase64 = btoa(
    String.fromCharCode(...new Uint8Array(exported)),
  );
  const pemKey = `-----BEGIN ${type.toUpperCase()} KEY-----\n${exportedAsBase64.match(/.{1,64}/g)?.join("\n")}\n-----END ${type.toUpperCase()} KEY-----`;
  return pemKey;
}

/**
 * Imports a PEM key to CryptoKey.
 */
async function importKeyFromPem(
  pem: string,
  type: "public" | "private",
): Promise<CryptoKey> {
  const pemHeader = `-----BEGIN ${type.toUpperCase()} KEY-----`;
  const pemFooter = `-----END ${type.toUpperCase()} KEY-----`;
  const pemContents = pem
    .replace(pemHeader, "")
    .replace(pemFooter, "")
    .replace(/\s/g, "");
  const binaryDer = atob(pemContents);
  const binaryDerArray = new Uint8Array(
    Array.from(binaryDer).map((char) => char.charCodeAt(0)),
  );

  return await crypto.subtle.importKey(
    type === "public" ? "spki" : "pkcs8",
    binaryDerArray,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    type === "public" ? ["encrypt"] : ["decrypt"],
  );
}

/**
 * Generates a random device secret for encrypting the private key.
 */
export async function generateDeviceSecret(): Promise<string> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}

/**
 * Encrypts data using AES-GCM with a password-derived key.
 */
async function encryptWithPassword(
  data: string,
  password: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Derive key from password
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"],
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );

  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    encoder.encode(data),
  );

  // Combine salt + iv + encrypted data
  const combined = new Uint8Array(
    salt.length + iv.length + encrypted.byteLength,
  );
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts data using AES-GCM with a password-derived key.
 */
async function decryptWithPassword(
  encryptedData: string,
  password: string,
): Promise<string> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const combined = Uint8Array.from(atob(encryptedData), (c) => c.charCodeAt(0));
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const data = combined.slice(28);

  // Derive key from password
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"],
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );

  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    data,
  );

  return decoder.decode(decrypted);
}

/**
 * Creates a certificate file containing the public and private keys.
 */
export async function createCertificate(): Promise<EncryptionCertificate> {
  const keyPair = await generateKeyPair();
  const publicKeyPem = await exportKeyToPem(keyPair.publicKey, "public");
  const privateKeyPem = await exportKeyToPem(keyPair.privateKey, "private");

  return {
    publicKey: publicKeyPem,
    privateKey: privateKeyPem,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Downloads the certificate as a file.
 */
export function downloadCertificate(certificate: EncryptionCertificate): void {
  const blob = new Blob([JSON.stringify(certificate, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `encryption-certificate-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Stores the private key in IndexedDB, encrypted with the device secret.
 */
export async function storePrivateKey(
  privateKey: string,
  deviceSecret: string,
  trustDevice: boolean,
): Promise<void> {
  const db = await openEncryptionDB();
  const encrypted = await encryptWithPassword(privateKey, deviceSecret);

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([ENCRYPTION_STORE_NAME], "readwrite");
    const store = transaction.objectStore(ENCRYPTION_STORE_NAME);

    const request = store.put({
      key: "privateKey",
      value: encrypted,
      trustDevice,
      updatedAt: Date.now(),
    });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieves the private key from IndexedDB and decrypts it.
 */
export async function getPrivateKey(
  deviceSecret: string,
): Promise<string | null> {
  try {
    const db = await openEncryptionDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([ENCRYPTION_STORE_NAME], "readonly");
      const store = transaction.objectStore(ENCRYPTION_STORE_NAME);
      const request = store.get("privateKey");

      request.onsuccess = async () => {
        if (!request.result) {
          resolve(null);
          return;
        }

        try {
          const decrypted = await decryptWithPassword(
            request.result.value,
            deviceSecret,
          );
          resolve(decrypted);
        } catch (error) {
          console.error("Failed to decrypt private key:", error);
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to get private key:", error);
    return null;
  }
}

/**
 * Removes the private key from IndexedDB.
 */
export async function removePrivateKey(): Promise<void> {
  const db = await openEncryptionDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([ENCRYPTION_STORE_NAME], "readwrite");
    const store = transaction.objectStore(ENCRYPTION_STORE_NAME);
    const request = store.delete("privateKey");

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Checks if the device is trusted (private key should persist on logout).
 */
export async function isDeviceTrusted(): Promise<boolean> {
  try {
    const db = await openEncryptionDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([ENCRYPTION_STORE_NAME], "readonly");
      const store = transaction.objectStore(ENCRYPTION_STORE_NAME);
      const request = store.get("privateKey");

      request.onsuccess = () => {
        resolve(request.result?.trustDevice ?? false);
      };

      request.onerror = () => reject(request.error);
    });
  } catch {
    return false;
  }
}

/**
 * Updates the trust device setting.
 */
export async function setDeviceTrust(
  trustDevice: boolean,
  deviceSecret: string,
): Promise<void> {
  const privateKey = await getPrivateKey(deviceSecret);
  if (!privateKey) {
    throw new Error("No private key found");
  }

  await storePrivateKey(privateKey, deviceSecret, trustDevice);
}

/**
 * Parses and validates a certificate file.
 */
export function parseCertificate(content: string): EncryptionCertificate {
  const cert = JSON.parse(content);

  if (!cert.publicKey || !cert.privateKey || !cert.createdAt) {
    throw new Error("Invalid certificate format");
  }

  return cert;
}
