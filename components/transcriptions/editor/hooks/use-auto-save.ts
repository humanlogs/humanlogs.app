"use client";

import { useEffect, useRef, useState } from "react";
import { TranscriptionSegment } from "../../../../hooks/use-api";
import { Speaker } from "./use-speaker-actions";
import { saveTranscriptionLocally } from "../../../../lib/indexeddb";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

type UseAutoSaveOptions = {
  transcriptionId: string;
  segments: TranscriptionSegment[];
  speakers: Speaker[];
  debounceMs?: number;
  onSaveStart?: () => void;
  onSaveComplete?: () => void;
  onSaveError?: (error: Error) => void;
};

export function useAutoSave({
  transcriptionId,
  segments,
  speakers,
  debounceMs = 3000,
  onSaveStart,
  onSaveComplete,
  onSaveError,
}: UseAutoSaveOptions) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<string | null>(null);
  const isMountedRef = useRef(false);

  // Track if this is the first render
  // Initialize as mounted on first render
  useEffect(() => {
    isMountedRef.current = true;
    // Initialize last saved to current state to avoid immediate save on mount
    lastSavedRef.current = JSON.stringify({ segments, speakers });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Skip auto-save on initial mount
    if (!isMountedRef.current) {
      return;
    }

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Create a snapshot of current state
    const currentState = JSON.stringify({ segments, speakers });

    // Skip if no changes
    if (currentState === lastSavedRef.current) {
      return;
    }

    // Show "Saving..." immediately when change is detected
    setSaveStatus("saving");
    onSaveStart?.();

    // Save to IndexedDB immediately (non-blocking fallback)
    saveTranscriptionLocally({
      transcriptionId,
      segments,
      speakers,
      serverUpdatedAt: undefined, // Will be updated after server save
    }).catch((error) => {
      console.error("Failed to save to IndexedDB:", error);
    });

    // Schedule actual save after debounce
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/transcriptions/${transcriptionId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            transcription: {
              words: segments,
              speakers,
            },
          }),
        });

        const responseData = await response.json();

        if (!response.ok) {
          throw new Error(responseData.error || "Failed to save transcription");
        }

        lastSavedRef.current = currentState;
        setSaveStatus("saved");
        onSaveComplete?.();

        // Update IndexedDB with server timestamp
        if (responseData.updatedAt) {
          saveTranscriptionLocally({
            transcriptionId,
            segments,
            speakers,
            serverUpdatedAt: responseData.updatedAt,
          }).catch((error) => {
            console.error(
              "Failed to update IndexedDB with server timestamp:",
              error,
            );
          });
        }

        // Reset to idle after 2 seconds
        setTimeout(() => {
          setSaveStatus("idle");
        }, 2000);
      } catch (error) {
        console.error("Auto-save failed:", error);
        setSaveStatus("error");
        onSaveError?.(
          error instanceof Error ? error : new Error("Unknown error"),
        );

        // Reset to idle after 3 seconds
        setTimeout(() => {
          setSaveStatus("idle");
        }, 3000);
      }
    }, debounceMs);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [
    transcriptionId,
    segments,
    speakers,
    debounceMs,
    onSaveStart,
    onSaveComplete,
    onSaveError,
  ]);

  return { saveStatus };
}
