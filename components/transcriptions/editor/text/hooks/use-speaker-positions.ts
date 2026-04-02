"use client";

import { useCallback, useEffect, useState } from "react";
import { EditorAPI } from "../api";

export interface SpeakerPosition {
  speakerId: string;
  /** Index of this speaker turn (0-based, used for color cycling) */
  index: number;
  /** px from the top of the editor's content area */
  top: number;
}

/**
 * Returns one position entry for every speaker *change* in the editor,
 * i.e. each time the speakerId on word spans transitions to a different value.
 * Re-measures on: segment changes, editor scroll, resize, and DOM mutations.
 */
export function useSpeakerPositions(editorAPI: EditorAPI): {
  positions: SpeakerPosition[];
  recalculate: () => void;
} {
  const [positions, setPositions] = useState<SpeakerPosition[]>([]);

  const recalculate = useCallback(() => {
    // Use the EditorAPI method directly
    setPositions(editorAPI.getSpeakerPositions());
    // editorAPI is a stable ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-measure after React has committed the new editorAPIRef.current.getSegments() to the DOM
  useEffect(() => {
    const id = requestAnimationFrame(recalculate);
    return () => cancelAnimationFrame(id);
  }, [recalculate]);

  // Re-measure on editor scroll
  useEffect(() => {
    window.addEventListener("scroll", recalculate, {
      passive: true,
    });
    window.addEventListener("resize", recalculate, {
      passive: true,
    });
    return () => {
      window.removeEventListener("scroll", recalculate);
      window.removeEventListener("resize", recalculate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recalculate]);

  // Re-measure when the editor is resized (window resize, sidebar toggle, etc.)
  useEffect(() => {
    editorAPI.addListener("change", recalculate);
    return () => {
      editorAPI.removeListener("change", recalculate);
    };
  }, [recalculate]);

  return { positions, recalculate };
}
