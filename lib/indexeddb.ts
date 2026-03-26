/**
 * IndexedDB wrapper for storing transcription edits locally as a fallback.
 * This enables offline editing and recovery in case of network issues.
 */

import { TranscriptionSegment } from "@/hooks/use-api";
import { Speaker } from "@/components/transcriptions/editor/hooks/use-speaker-actions";

const DB_NAME = "transcription-storage";
const DB_VERSION = 1;
const STORE_NAME = "transcriptions";

export type LocalTranscriptionData = {
  transcriptionId: string;
  segments: TranscriptionSegment[];
  speakers: Speaker[];
  updatedAt: number; // Unix timestamp
  serverUpdatedAt?: string; // ISO string from server
};

/**
 * Opens the IndexedDB database, creating/upgrading as needed.
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: "transcriptionId",
        });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };
  });
}

/**
 * Saves transcription data to IndexedDB.
 */
export async function saveTranscriptionLocally(
  data: Omit<LocalTranscriptionData, "updatedAt"> & { updatedAt?: number },
): Promise<void> {
  try {
    const db = await openDB();

    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    const dataToSave: LocalTranscriptionData = {
      ...data,
      updatedAt: data.updatedAt || Date.now(),
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.put(dataToSave);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    db.close();
  } catch (error) {
    console.error("Failed to save transcription locally:", error);
    // Don't throw - IndexedDB failures shouldn't break the app
  }
}

/**
 * Retrieves transcription data from IndexedDB.
 */
export async function getTranscriptionLocally(
  transcriptionId: string,
): Promise<LocalTranscriptionData | null> {
  try {
    const db = await openDB();

    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);

    const data = await new Promise<LocalTranscriptionData | undefined>(
      (resolve, reject) => {
        const request = store.get(transcriptionId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      },
    );

    db.close();

    return data || null;
  } catch (error) {
    console.error("Failed to get transcription locally:", error);
    return null;
  }
}

/**
 * Deletes transcription data from IndexedDB.
 */
export async function deleteTranscriptionLocally(
  transcriptionId: string,
): Promise<void> {
  try {
    const db = await openDB();

    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(transcriptionId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    db.close();
  } catch (error) {
    console.error("Failed to delete transcription locally:", error);
  }
}

/**
 * Checks if local data is newer than server data.
 */
export function isLocalVersionNewer(
  localUpdatedAt: number,
  serverUpdatedAt: string,
): boolean {
  const serverTimestamp = new Date(serverUpdatedAt).getTime();
  return localUpdatedAt > serverTimestamp;
}
