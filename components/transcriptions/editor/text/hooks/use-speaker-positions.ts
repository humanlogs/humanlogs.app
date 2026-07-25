"use client";

import { useEffect, useRef, useState } from "react";
import { EditorAPI } from "../api";

export interface SpeakerPosition {
  speakerId: string;
  /** Index of this speaker turn (0-based, used for color cycling) */
  index: number;
  /** px from the top of the editor's content area */
  top: number;
}

const signature = (positions: SpeakerPosition[]): string =>
  positions.map((p) => `${p.speakerId}:${p.index}:${Math.round(p.top)}`).join("|");

/**
 * Returns one position entry per speaker turn in the editor. Re-measures on segment
 * changes, editor scroll, resize, and DOM mutations.
 *
 * Perf: all triggers are coalesced into a single pending `requestAnimationFrame`
 * (so a burst of edits / a remote sync recomputes at most once per frame), and the
 * measured positions are diffed against the previous set — an unchanged result skips
 * the `setState`, avoiding a needless re-render of the speaker column.
 */
export function useSpeakerPositions(editorAPI: EditorAPI): {
  positions: SpeakerPosition[];
  recalculate: () => void;
} {
  const [positions, setPositions] = useState<SpeakerPosition[]>([]);
  const rafRef = useRef<number | null>(null);
  const sigRef = useRef<string>("");

  useEffect(() => {
    // Coalesce every trigger into one rAF; skip the setState when nothing changed.
    const schedule = () => {
      if (rafRef.current !== null) return; // already pending this frame
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const next = editorAPI.getSpeakerPositions();
        const sig = signature(next);
        if (sig === sigRef.current) return; // identical → no re-render
        sigRef.current = sig;
        setPositions(next);
      });
    };

    // Initial measure after commit.
    schedule();

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    editorAPI.addListener("speakersOffsets", schedule);
    editorAPI.addListener("change", schedule);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      editorAPI.removeListener("speakersOffsets", schedule);
      editorAPI.removeListener("change", schedule);
    };
    // editorAPI is a stable ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Force an immediate recompute (bypasses the diff) — used by imperative callers.
  const recalculate = () => {
    sigRef.current = "";
    setPositions(editorAPI.getSpeakerPositions());
  };

  return { positions, recalculate };
}
