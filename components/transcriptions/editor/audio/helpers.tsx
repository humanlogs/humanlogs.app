"use client";

import { TranscriptionSegment } from "../../../../hooks/use-transcriptions";
import { getSpeakerColor } from "../../../../lib/utils/utils";
import "../index.css"; // Import custom styles for canvas

// Audio controls interface
export interface AudioControls {
  isPlaying: boolean;
  playbackSpeed: number;
  totalDuration?: number;
  togglePlayPause: () => void;
  pause: () => void;
  play: () => void;
  seekTo: (time: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  onTimeUpdate: (callback: (currentTime: number) => void) => void;
}

// Extract speaker segments from transcription
export const getSpeakerSegments = (oSegments: TranscriptionSegment[]) => {
  const segments: (Partial<TranscriptionSegment> & { color: string })[] = [];
  const speakerColors = new Map<string, string>();
  let colorIndex = 0;

  let currentSpeaker: string | null = null;
  let segmentStart = 0;

  for (const word of oSegments) {
    if (!word.speakerId) continue;

    // Assign color to new speaker
    if (!speakerColors.has(word.speakerId)) {
      speakerColors.set(word.speakerId, getSpeakerColor(colorIndex++));
    }

    // New speaker segment
    if (currentSpeaker !== word.speakerId) {
      // Save previous segment
      if (currentSpeaker) {
        segments.push({
          start: segmentStart,
          end: word.start,
          speakerId: currentSpeaker,
          color: speakerColors.get(currentSpeaker) || "#4a5568",
        });
      }
      currentSpeaker = word.speakerId;
      segmentStart = word.start || 0;
    }
  }

  // Add final segment
  if (currentSpeaker && segments.length > 0) {
    const lastWord = oSegments[oSegments.length - 1];
    segments.push({
      start: segmentStart,
      end: lastWord.end,
      speakerId: currentSpeaker,
      color: speakerColors.get(currentSpeaker) || "#4a5568",
    });
  }

  return segments;
};

// Convert character offset to time using segments
export function offsetToTime(
  offset: number,
  segments: TranscriptionSegment[],
): number {
  let currentOffset = 0;

  for (const segment of segments) {
    const segmentLength = segment.text.length;

    if (currentOffset + segmentLength >= offset) {
      // Cursor is within this segment
      const positionInSegment = offset - currentOffset;
      const ratio = positionInSegment / segmentLength;
      const segmentDuration = (segment.end || 0) - (segment.start || 0);
      return (segment.start || 0) + segmentDuration * ratio;
    }

    currentOffset += segmentLength;
  }

  // If offset is beyond all segments, return the end time of the last segment
  return segments[segments.length - 1]?.end || 0;
}

// Cache keys for waveform peaks
const WAVEFORM_DB_NAME = "waveform_cache";
const WAVEFORM_STORE_NAME = "peaks";
const WAVEFORM_VERSION = 1;

// Initialize IndexedDB for waveform peaks
function getWaveformDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(WAVEFORM_DB_NAME, WAVEFORM_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(WAVEFORM_STORE_NAME)) {
        db.createObjectStore(WAVEFORM_STORE_NAME);
      }
    };
  });
}

// Loading placeholder with animated bars
export const WaveformLoader = () => {
  const bars = 300; // Number of bars to show (4x more since they're smaller)
  return (
    <div className="w-full h-full flex items-center justify-between gap-px px-2">
      {Array.from({ length: bars }).map((_, i) => {
        const randomHeight = Math.random() * 10 + 5; // 10-40% height (2x smaller)
        const randomDelay = Math.random() * 2; // 0-2s delay
        return (
          <div
            key={i}
            className="bg-gray-400 dark:bg-gray-600 rounded-sm animate-pulse grow"
            style={{
              height: `${randomHeight}%`,
              animationDelay: `${randomDelay}s`,
              animationDuration: "1.5s",
            }}
          />
        );
      })}
    </div>
  );
};

// Save waveform peaks and duration to IndexedDB
export async function saveWaveformPeaks(
  transcriptionId: string,
  peaks: number[][],
  duration: number,
): Promise<void> {
  try {
    const db = await getWaveformDB();
    const transaction = db.transaction([WAVEFORM_STORE_NAME], "readwrite");
    const store = transaction.objectStore(WAVEFORM_STORE_NAME);
    const data = { peaks, duration };
    await store.put(data, transcriptionId);
    console.log(
      "[Audio] Cached waveform peaks + duration in IndexedDB, size:",
      (JSON.stringify(data).length / 1024).toFixed(2),
      "KB, duration:",
      duration.toFixed(2),
      "s",
    );
  } catch (e) {
    console.warn("[Audio] Failed to cache waveform peaks:", e);
  }
}

// Load waveform peaks and duration from IndexedDB
export async function loadWaveformPeaks(
  transcriptionId: string,
): Promise<{ peaks: number[][]; duration: number } | null> {
  try {
    const db = await getWaveformDB();
    const transaction = db.transaction([WAVEFORM_STORE_NAME], "readonly");
    const store = transaction.objectStore(WAVEFORM_STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get(transcriptionId);
      request.onsuccess = () => {
        if (request.result) {
          // Handle legacy cached data (only peaks) and new format (peaks + duration)
          const data = request.result;
          if (Array.isArray(data)) {
            // Legacy format: just peaks array
            console.log(
              "[Audio] Found cached waveform peaks (legacy format) in IndexedDB",
            );
            resolve(null); // Force re-cache with new format
          } else if (data.peaks && typeof data.duration === "number") {
            // New format: object with peaks and duration
            console.log(
              "[Audio] Found cached waveform peaks + duration in IndexedDB, size:",
              (JSON.stringify(data).length / 1024).toFixed(2),
              "KB, duration:",
              data.duration.toFixed(2),
              "s",
            );
            resolve(data);
          } else {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn("[Audio] Failed to load cached waveform peaks:", e);
    return null;
  }
}
