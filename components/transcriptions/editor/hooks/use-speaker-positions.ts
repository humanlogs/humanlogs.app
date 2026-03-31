"use client";

import { useCallback, useEffect, useState } from "react";
import { TranscriptionSegment } from "@/hooks/use-transcriptions";
import { EditorAPI } from "./editor-api";

export interface SpeakerPosition {
  speakerId: string;
  /** Index of this speaker turn (0-based, used for colour cycling) */
  index: number;
  /** px from the top of the editor's visible area */
  top: number;
}

/**
 * Returns one position entry for every speaker *change* in the editor,
 * i.e. each time the speakerId on word spans transitions to a different value.
 * Re-measures on: segment changes, editor scroll, resize, and DOM mutations.
 */
export function useSpeakerPositions(
  editorAPI: EditorAPI,
  segments: TranscriptionSegment[],
): SpeakerPosition[] {
  const [positions, setPositions] = useState<SpeakerPosition[]>([]);

  const recalculate = useCallback(() => {
    // Use the EditorAPI method directly
    setPositions(editorAPI.getSpeakerPositions());
    // editorAPI is a stable ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-measure after React has committed the new segments to the DOM
  useEffect(() => {
    const id = requestAnimationFrame(recalculate);
    return () => cancelAnimationFrame(id);
  }, [segments, recalculate]);

  // Re-measure on editor scroll
  useEffect(() => {
    const cleanup = editorAPI.addEventListener("scroll", recalculate, {
      passive: true,
    });
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recalculate]);

  // Re-measure when the editor is resized (window resize, sidebar toggle, etc.)
  useEffect(() => {
    const cleanup = editorAPI.observeResize(recalculate);
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recalculate]);

  // Re-measure on any DOM mutation inside the editor (typing reflows layout)
  useEffect(() => {
    const cleanup = editorAPI.observeMutations(recalculate);
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recalculate]);

  return positions;
}
