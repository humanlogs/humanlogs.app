"use client";

import { useCallback, useEffect, useRef } from "react";
import { TranscriptionSegment } from "@/hooks/use-transcriptions";
import { normalizeEditorSegments } from "./use-normalize-editor-segments";
import { SelectionOffsets } from "../utils/selection";
import { bracketWrapState } from "./use-bracket-wrap";
import { useUndoHistory } from "./use-undo-history";
import { EditorAPI } from "./editor-api";

export function useEditorSync(
  editorAPI: EditorAPI,
  segmentsRef: { current: TranscriptionSegment[] | null },
  segments: TranscriptionSegment[],
  onChange: (segments: TranscriptionSegment[]) => void,
) {
  const history = useUndoHistory();
  const beforeInputSelection = useRef<SelectionOffsets | null>(null);

  // Sync DOM when segments prop changes from outside (speaker changes, etc.).
  // We own the undo stack so we can always do a full rewrite without worry.
  useEffect(() => {
    if (!editorAPI.ready()) return;
    if (segments === segmentsRef.current) return;

    const isFirstRender = segmentsRef.current === null;
    const normalized = normalizeEditorSegments(segments);

    // Save the outgoing state to the undo stack so Ctrl+Z can restore it.
    if (!isFirstRender && segmentsRef.current !== null) {
      const sel = editorAPI.getSelectionOffsets();
      history.record(segmentsRef.current, sel);
    }

    const sel = !isFirstRender ? editorAPI.getSelectionOffsets() : null;
    editorAPI.setSegments(normalized);
    segmentsRef.current = normalized;
    if (sel !== null) editorAPI.restoreSelection(sel.start, sel.end);

    if (normalized !== segments) onChange(normalized);
    // editorAPI is stable — not needed in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments]);

  // Capture selection before any input modifications
  const handleBeforeInput = useCallback(() => {
    beforeInputSelection.current = editorAPI.getSelectionOffsets();
    // editorAPI and beforeInputSelection are stable refs — not needed in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Parse the current DOM and notify the parent.
  // Save the pre-change snapshot to the undo stack on every input event so
  // that Ctrl+Z can walk back through typing and formatting operations.
  const handleInput = useCallback(() => {
    // TODO change me, this is currently super slow

    return;

    const raw = editorAPI.getSegments();
    const normalized = normalizeEditorSegments(raw);

    // Record the state *before* this change.
    // For bracket wrapping, use the original selection captured before the wrap.
    // Otherwise, use beforeInput selection if available, or current selection as fallback.
    if (segmentsRef.current !== null) {
      const sel =
        bracketWrapState.originalSelection ||
        beforeInputSelection.current ||
        editorAPI.getSelectionOffsets();
      history.record(segmentsRef.current, sel);
      beforeInputSelection.current = null;
    }

    const rawText = raw.map((s) => s.text).join("");
    const normalizedText = normalized.map((s) => s.text).join("");
    if (rawText !== normalizedText || true) {
      // Normalization changed visible text (pause → "(pause)", speaker
      // boundary → "\n\n").  Rewrite DOM to reflect the canonical form.
      const sel = editorAPI.getSelectionOffsets();
      editorAPI.setSegments(normalized);
      if (sel !== null) editorAPI.restoreSelection(sel.start, sel.end);
    }

    // segmentsRef must point to `normalized` so that the parent echo-back
    // of the same normalized value hits the `segments === segmentsRef.current`
    // early-return in the sync effect and avoids a redundant DOM rewrite.
    segmentsRef.current = normalized;
    onChange(normalized);
    // editorAPI and segmentsRef are stable refs — not needed in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onChange]);

  // Ctrl+Z / Ctrl+Y (also Ctrl+Shift+Z on Mac for redo).
  // We intercept these before the browser acts on its own (likely empty) stack.
  const handleUndoKeyDown = useCallback(
    (e: Partial<React.KeyboardEvent>) => {
      if (!e.metaKey && !e.ctrlKey) return;
      const isUndo = !e.shiftKey && e.key === "z";
      const isRedo =
        (e.shiftKey && e.key?.toLocaleLowerCase() === "z") ||
        (!e.shiftKey && e.key === "y");
      if (!isUndo && !isRedo) return;

      e?.preventDefault?.();
      if (!editorAPI.ready() || segmentsRef.current === null) return;

      const currentSel = editorAPI.getSelectionOffsets();
      const historyState = isUndo
        ? history.undo(segmentsRef.current, currentSel)
        : history.redo(segmentsRef.current, currentSel);
      if (!historyState) return;

      editorAPI.setSegments(historyState.segments);
      segmentsRef.current = historyState.segments;
      if (historyState.selection !== null) {
        editorAPI.restoreSelection(
          historyState.selection.start,
          historyState.selection.end,
        );
      }
      onChange(historyState.segments);
    },
    // editorAPI and segmentsRef are stable refs, history methods are stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onChange],
  );

  return { handleInput, handleBeforeInput, handleUndoKeyDown };
}
