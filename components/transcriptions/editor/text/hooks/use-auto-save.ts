"use client";

import { useSaveTranscription } from "@/hooks/use-transcriptions";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { EditorAPI } from "../api";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

type UseAutoSaveOptions = {
  transcriptionId: string;
  editorAPI: EditorAPI;
  debounceMs?: number;
  maxDebounceMs?: number;
  onSaveStart?: () => void;
  onSaveComplete?: () => void;
  onSaveError?: (error: Error) => void;
};

export function useAutoSave({
  transcriptionId,
  editorAPI,
  debounceMs = 3000,
  maxDebounceMs = 60000,
  onSaveStart,
  onSaveComplete,
  onSaveError,
}: UseAutoSaveOptions) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxDebounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<string | null>(null);
  const lastSaveTimestampRef = useRef<number>(0);
  const isMountedRef = useRef(false);
  const saveTranscription = useSaveTranscription(transcriptionId);

  // Track if this is the first render
  // Initialize as mounted on first render
  useEffect(() => {
    isMountedRef.current = true;
    // Initialize last saved to current state to avoid immediate save on mount
    lastSavedRef.current = JSON.stringify({
      segments: editorAPI.getSegments(),
      speakers: editorAPI.getSpeakers(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Manual save function
  const performSave = async (isManual = false, forceSave = false) => {
    const currentState = JSON.stringify({
      segments: editorAPI.getSegments(),
      speakers: editorAPI.getSpeakers(),
    });

    // Skip if no changes (unless force save is enabled)
    if (!forceSave && currentState === lastSavedRef.current) {
      if (isManual) {
        toast.success("Your work is saved automatically ;)");
      }
      return;
    }

    setSaveStatus("saving");
    onSaveStart?.();

    try {
      await saveTranscription.mutateAsync({
        words: editorAPI.getSegments(),
        speakers: editorAPI.getSpeakers(),
      });

      lastSavedRef.current = currentState;
      lastSaveTimestampRef.current = Date.now();
      setSaveStatus("saved");
      onSaveComplete?.();

      if (isManual) {
        toast.success("Your work is saved automatically ;)");
      }

      // Reset to idle after 2 seconds
      setTimeout(() => {
        setSaveStatus("idle");
      }, 2000);
    } catch (error) {
      console.error("Save failed:", error);
      setSaveStatus("error");
      onSaveError?.(
        error instanceof Error ? error : new Error("Unknown error"),
      );

      // Reset to idle after 3 seconds
      setTimeout(() => {
        setSaveStatus("idle");
      }, 3000);
    }
  };

  // Handle Ctrl+S / Cmd+S keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();

        // Check if last save was more than 10 seconds ago
        const timeSinceLastSave = Date.now() - lastSaveTimestampRef.current;
        const shouldForceSave = timeSinceLastSave > 10000;

        performSave(true, shouldForceSave);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onChange = useCallback(() => {
    // Skip auto-save on initial mount
    if (!isMountedRef.current) {
      return;
    }

    // Clear existing timeouts
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Create a snapshot of current state
    const currentState = JSON.stringify({
      segments: editorAPI.getSegments(),
      speakers: editorAPI.getSpeakers(),
    });

    // Skip if no changes
    if (currentState === lastSavedRef.current) {
      return;
    }

    // Show "Saving..." immediately when change is detected
    setSaveStatus("saving");
    onSaveStart?.();

    // If this is the first change, start the max debounce timer
    if (!maxDebounceTimeoutRef.current) {
      maxDebounceTimeoutRef.current = setTimeout(() => {
        performSave(false);
        maxDebounceTimeoutRef.current = null;
      }, maxDebounceMs);
    }

    // Schedule actual save after regular debounce
    saveTimeoutRef.current = setTimeout(() => {
      // Clear the max debounce timer since we're saving now
      if (maxDebounceTimeoutRef.current) {
        clearTimeout(maxDebounceTimeoutRef.current);
        maxDebounceTimeoutRef.current = null;
      }
      performSave(false);
    }, debounceMs);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcriptionId, debounceMs, maxDebounceMs]);

  // Cleanup max debounce timer on unmount
  useEffect(() => {
    return () => {
      if (maxDebounceTimeoutRef.current) {
        clearTimeout(maxDebounceTimeoutRef.current);
      }
    };
  }, []);

  // Warn user before leaving page if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Check if there are pending saves
      const hasPendingSave =
        saveTimeoutRef.current !== null ||
        maxDebounceTimeoutRef.current !== null;

      // Check if current state differs from last saved state
      const currentState = JSON.stringify({
        segments: editorAPI.getSegments(),
        speakers: editorAPI.getSpeakers(),
      });
      const hasUnsavedChanges = currentState !== lastSavedRef.current;

      // Only warn if there are pending saves or unsaved changes
      if (hasPendingSave || hasUnsavedChanges) {
        // Standard way to trigger browser warning
        e.preventDefault();
        e.returnValue = ""; // Chrome requires returnValue to be set
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [editorAPI]);

  return { saveStatus, onChange };
}
