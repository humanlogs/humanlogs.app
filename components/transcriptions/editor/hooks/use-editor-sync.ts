"use client";

import { RefObject, useCallback, useEffect } from "react";
import { TranscriptionSegment } from "../../../../hooks/use-api";
import { normalizeEditorSegments } from "../use-normalize-editor-segments";
import { domToSegments } from "../utils/dom";
import { segmentsToHtml } from "../utils/html";
import { getSelectionOffsets, restoreSelection } from "../utils/selection";
import { useUndoHistory } from "./use-undo-history";

export function useEditorSync(
  editorRef: RefObject<HTMLDivElement | null>,
  segmentsRef: { current: TranscriptionSegment[] | null },
  segments: TranscriptionSegment[],
  onChange: (segments: TranscriptionSegment[]) => void,
) {
  const history = useUndoHistory();

  // Sync DOM when segments prop changes from outside (speaker changes, etc.).
  // We own the undo stack so we can always do a full rewrite without worry.
  useEffect(() => {
    if (!editorRef.current) return;
    if (segments === segmentsRef.current) return;

    const isFirstRender = segmentsRef.current === null;
    const normalized = normalizeEditorSegments(segments);

    // Save the outgoing state to the undo stack so Ctrl+Z can restore it.
    if (!isFirstRender && segmentsRef.current !== null) {
      history.record(segmentsRef.current);
    }

    const sel = !isFirstRender ? getSelectionOffsets(editorRef.current) : null;
    editorRef.current.innerHTML = segmentsToHtml(normalized);
    segmentsRef.current = normalized;
    if (sel !== null) restoreSelection(editorRef.current, sel.start, sel.end);

    if (normalized !== segments) onChange(normalized);
    // editorRef and segmentsRef are stable refs — not needed in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments]);

  // Parse the current DOM and notify the parent.
  // Save the pre-change snapshot to the undo stack on every input event so
  // that Ctrl+Z can walk back through typing and formatting operations.
  const handleInput = useCallback(() => {
    if (!editorRef.current) return;
    const raw = domToSegments(editorRef.current);
    const normalized = normalizeEditorSegments(raw);

    // Record the state *before* this change.
    if (segmentsRef.current !== null) {
      history.record(segmentsRef.current);
    }

    const rawText = raw.map((s) => s.text).join("");
    const normalizedText = normalized.map((s) => s.text).join("");
    if (rawText !== normalizedText || true) {
      // Normalization changed visible text (pause → "(pause)", speaker
      // boundary → "\n\n").  Rewrite DOM to reflect the canonical form.
      const sel = getSelectionOffsets(editorRef.current);
      editorRef.current.innerHTML = segmentsToHtml(normalized);
      if (sel !== null) restoreSelection(editorRef.current, sel.start, sel.end);
    }

    // segmentsRef must point to `normalized` so that the parent echo-back
    // of the same normalized value hits the `segments === segmentsRef.current`
    // early-return in the sync effect and avoids a redundant DOM rewrite.
    segmentsRef.current = normalized;
    onChange(normalized);
    // editorRef and segmentsRef are stable refs — not needed in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onChange]);

  // Ctrl+Z / Ctrl+Y (also Ctrl+Shift+Z on Mac for redo).
  // We intercept these before the browser acts on its own (likely empty) stack.
  const handleUndoKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return;
      const isUndo = !e.shiftKey && e.key === "z";
      const isRedo =
        (e.shiftKey && e.key === "z") || (!e.shiftKey && e.key === "y");
      if (!isUndo && !isRedo) return;

      e.preventDefault();
      if (!editorRef.current || segmentsRef.current === null) return;

      const target = isUndo
        ? history.undo(segmentsRef.current)
        : history.redo(segmentsRef.current);
      if (!target) return;

      editorRef.current.innerHTML = segmentsToHtml(target);
      segmentsRef.current = target;
      onChange(target);
    },
    // editorRef and segmentsRef are stable refs, history methods are stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onChange],
  );

  return { handleInput, handleUndoKeyDown };
}
