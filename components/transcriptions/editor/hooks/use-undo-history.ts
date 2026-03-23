"use client";

import { useCallback, useRef } from "react";
import { TranscriptionSegment } from "../../../../hooks/use-api";

function segmentsKey(segs: TranscriptionSegment[]): string {
  return segs
    .map(
      (s) =>
        `${s.text}¦${s.type}¦${s.speakerId ?? ""}¦${(s.modifiers ?? []).join(",")}`,
    )
    .join("|");
}

/**
 * Ref-based custom undo/redo stack for TranscriptionSegment arrays.
 *
 * By owning the undo stack we can freely rewrite `innerHTML` whenever needed
 * (normalization, speaker changes, etc.) without losing history.
 *
 * All returned methods are stable references.
 */
export function useUndoHistory() {
  const past = useRef<TranscriptionSegment[][]>([]);
  const future = useRef<TranscriptionSegment[][]>([]);

  /**
   * Record a new change by saving the state *before* it happened.
   * `from` is the snapshot to restore if the user Ctrl+Z's.
   * Clears the redo stack (a new action invalidates any undone future).
   * Deduplicates: if the top of the past stack already matches `from`, skips.
   */
  const record = useCallback((from: TranscriptionSegment[]) => {
    const top = past.current.at(-1);
    if (top !== undefined && segmentsKey(top) === segmentsKey(from)) return;
    past.current.push(from);
    future.current = [];
  }, []);

  /**
   * Ctrl+Z: pops and returns the previous state, and saves `current` to the
   * redo stack so Ctrl+Y can re-apply.  Returns null if nothing to undo.
   */
  const undo = useCallback(
    (current: TranscriptionSegment[]): TranscriptionSegment[] | null => {
      const prev = past.current.pop();
      if (!prev) return null;
      future.current.push(current);
      return prev;
    },
    [],
  );

  /**
   * Ctrl+Y: pops and returns the next state, saving `current` back into the
   * past stack.  Returns null if nothing to redo.
   * Note: we push directly without calling `record()` so that we don't clear
   * the remaining redo entries.
   */
  const redo = useCallback(
    (current: TranscriptionSegment[]): TranscriptionSegment[] | null => {
      const next = future.current.pop();
      if (!next) return null;
      past.current.push(current);
      return next;
    },
    [],
  );

  return { record, undo, redo };
}
