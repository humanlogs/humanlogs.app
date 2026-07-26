"use client";

import { useSaveTranscription } from "@/hooks/use-transcriptions";
import { useQueryClient } from "@tanstack/react-query";
import {
  MutableRefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { EditorAPI } from "../api";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

type UseAutoSaveOptions = {
  transcriptionId: string;
  editorAPI: EditorAPI;
  debounceMs?: number;
  maxDebounceMs?: number;
  /** Collab session AES key — encrypted saves reuse it instead of rotating. */
  sessionAesKey?: string | null;
  onSaveStart?: () => void;
  onSaveComplete?: () => void;
  onSaveError?: (error: Error) => void;
};

export function useAutoSave({
  transcriptionId,
  editorAPI,
  debounceMs = 3000,
  maxDebounceMs = 60000,
  sessionAesKey,
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
  const isDirtyRef = useRef(false);
  const performSaveRef = useRef<
    (isManual?: boolean, forceSave?: boolean) => Promise<void>
  >(async () => {});
  const queryClient = useQueryClient();
  const saveTranscription = useSaveTranscription(transcriptionId, sessionAesKey);

  // Track if this is the first render
  // Initialize as mounted on first render
  useEffect(() => {
    isMountedRef.current = true;
    // Initialize last saved to current state to avoid immediate save on mount
    lastSavedRef.current = JSON.stringify({
      segments: editorAPI.getSegments(),
      speakers: editorAPI.getSpeakers(),
    });
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

      // Keep cache warm and fresh for fast back navigation to this transcription.
      await queryClient.invalidateQueries({
        queryKey: ["transcriptions", transcriptionId],
      });
      await queryClient.refetchQueries({
        queryKey: ["transcriptions", transcriptionId],
        type: "all",
      });

      lastSavedRef.current = currentState;
      lastSaveTimestampRef.current = Date.now();
      setBeforeUnloadWarning(false, isDirtyRef);
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

  // Keep performSaveRef up to date so the navigation guard can always call the latest version
  performSaveRef.current = performSave;

  // Imperative flush — persist current state NOW (used on collab leadership handoff
  // so the incoming save leader closes any unsaved window immediately).
  const flush = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    if (maxDebounceTimeoutRef.current) {
      clearTimeout(maxDebounceTimeoutRef.current);
      maxDebounceTimeoutRef.current = null;
    }
    void performSaveRef.current(false, false);
  }, []);

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

    setBeforeUnloadWarning(true, isDirtyRef);

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

  // Guard against in-app navigation (Next.js client-side routing via history.pushState)
  // When navigating away with unsaved changes, flush the save immediately then navigate.
  useEffect(() => {
    const originalPushState = window.history.pushState.bind(window.history);

    window.history.pushState = (
      state: Parameters<typeof window.history.pushState>[0],
      unused: string,
      url?: string | URL | null,
    ) => {
      if (isDirtyRef.current) {
        // Cancel pending debounce timers
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = null;
        }
        if (maxDebounceTimeoutRef.current) {
          clearTimeout(maxDebounceTimeoutRef.current);
          maxDebounceTimeoutRef.current = null;
        }
        // Save immediately, then navigate regardless of outcome
        performSaveRef.current().finally(() => {
          originalPushState(state, unused, url);
        });
        return;
      }
      originalPushState(state, unused, url);
    };

    return () => {
      window.history.pushState = originalPushState;
    };
  }, []);

  return { saveStatus, onChange, flush };
}

const setBeforeUnloadWarning = (
  enabled: boolean,
  isDirtyRef?: MutableRefObject<boolean>,
) => {
  if (isDirtyRef) isDirtyRef.current = enabled;
  if (enabled) {
    window.onbeforeunload = () =>
      "You have unsaved changes. Are you sure you want to leave?";
  } else {
    window.onbeforeunload = null;
  }
};
