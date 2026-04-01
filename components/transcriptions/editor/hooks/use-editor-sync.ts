"use client";

import { useCallback, useEffect, useRef } from "react";
import { TranscriptionSegment } from "@/hooks/use-transcriptions";
import { normalizeEditorSegments } from "./use-normalize-editor-segments";
import { SelectionOffsets } from "../utils/selection";
import { bracketWrapState } from "./use-bracket-wrap";
import { useUndoHistory } from "./use-undo-history";
import { EditorAPI } from "./editor-api";

// Mutation types to track changes made during processing
type SegmentMutation =
  | { type: "change"; segmentIndex: number; oldText: string; newText: string }
  | { type: "delete"; segmentIndex: number; text: string }
  | { type: "insert"; segmentIndex: number; text: string }
  | { type: "split"; segmentIndex: number; count: number }
  | { type: "merge"; startIndex: number; endIndex: number };

/**
 * Apply direct changes to segments based on what's in the DOM.
 * Compares current segments with DOM segments to detect changes.
 * Returns modified segments and list of mutations applied.
 */
function applyDirectChanges(
  currentSegments: TranscriptionSegment[],
  domSegments: TranscriptionSegment[],
  previousSelection: SelectionOffsets | null,
  currentSelection: SelectionOffsets | null,
): { segments: TranscriptionSegment[]; mutations: SegmentMutation[] } {
  const mutations: SegmentMutation[] = [];

  // For now, we'll use the DOM segments as the source of truth
  // and track what changed by comparing with current segments
  const resultSegments: TranscriptionSegment[] = [];

  // Build a character-position map for both segment arrays
  let currentPos = 0;
  const currentPosMap: Array<{
    segment: TranscriptionSegment;
    offset: number;
    index: number;
  }> = [];
  currentSegments.forEach((seg, index) => {
    currentPosMap.push({ segment: seg, offset: currentPos, index });
    currentPos += seg.text.length;
  });

  let domPos = 0;
  const domPosMap: Array<{
    segment: TranscriptionSegment;
    offset: number;
    index: number;
  }> = [];
  domSegments.forEach((seg, index) => {
    domPosMap.push({ segment: seg, offset: domPos, index });
    domPos += seg.text.length;
  });

  // Simple diff: compare segment by segment
  const maxLen = Math.max(currentSegments.length, domSegments.length);
  for (let i = 0; i < maxLen; i++) {
    const currentSeg = currentSegments[i];
    const domSeg = domSegments[i];

    if (!currentSeg && domSeg) {
      // New segment inserted
      mutations.push({ type: "insert", segmentIndex: i, text: domSeg.text });
      resultSegments.push(domSeg);
    } else if (currentSeg && !domSeg) {
      // Segment deleted
      mutations.push({
        type: "delete",
        segmentIndex: i,
        text: currentSeg.text,
      });
    } else if (currentSeg && domSeg) {
      if (currentSeg.text !== domSeg.text) {
        // Text changed
        mutations.push({
          type: "change",
          segmentIndex: i,
          oldText: currentSeg.text,
          newText: domSeg.text,
        });
      }
      resultSegments.push(domSeg);
    }
  }

  return { segments: resultSegments, mutations };
}

/**
 * Apply normalization to segments and track mutations made during normalization.
 * Wraps normalizeEditorSegments and compares before/after to detect changes.
 */
function normalizeWithMutations(segments: TranscriptionSegment[]): {
  segments: TranscriptionSegment[];
  mutations: SegmentMutation[];
} {
  const normalized = normalizeEditorSegments(segments);
  const mutations: SegmentMutation[] = [];

  // Track what changed during normalization
  // This is a simplified version - could be more detailed
  if (segments.length !== normalized.length) {
    mutations.push({
      type: "split",
      segmentIndex: 0,
      count: Math.abs(normalized.length - segments.length),
    });
  }

  // Check for text changes
  const minLen = Math.min(segments.length, normalized.length);
  for (let i = 0; i < minLen; i++) {
    if (segments[i].text !== normalized[i].text) {
      mutations.push({
        type: "change",
        segmentIndex: i,
        oldText: segments[i].text,
        newText: normalized[i].text,
      });
    }
  }

  return { segments: normalized, mutations };
}

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
    if (!editorAPI.ready() || segmentsRef.current === null) return;

    // Get current selection to know where changes occurred
    const currentSelection = editorAPI.getSelectionOffsets();
    const previousSelection = beforeInputSelection.current || currentSelection;

    // PART 1: Apply changes to segments based on cursor position
    // Instead of reading from DOM, we work with the segments directly
    const { segments: modifiedSegments, mutations: directMutations } =
      applyDirectChanges(
        segmentsRef.current,
        editorAPI.getSegments(), // Still need to get what's in DOM for now
        previousSelection,
        currentSelection,
      );

    console.log("Direct mutations detected:", directMutations);

    // PART 2: Normalize and track additional mutations
    const { segments: normalizedSegments, mutations: normalizeMutations } =
      normalizeWithMutations(modifiedSegments);

    // Record the state *before* this change for undo
    if (segmentsRef.current !== null) {
      const sel =
        bracketWrapState.originalSelection ||
        beforeInputSelection.current ||
        editorAPI.getSelectionOffsets();
      history.record(segmentsRef.current, sel);
      beforeInputSelection.current = null;
    }

    // Check if normalization changed the content
    const modifiedText = modifiedSegments.map((s) => s.text).join("");
    const normalizedText = normalizedSegments.map((s) => s.text).join("");

    if (modifiedText !== normalizedText) {
      // Normalization changed visible text (pause → "(pause)", speaker
      // boundary → "\n\n").  Rewrite DOM to reflect the canonical form.
      const sel = editorAPI.getSelectionOffsets();
      editorAPI.setSegments(normalizedSegments);
      if (sel !== null) editorAPI.restoreSelection(sel.start, sel.end);
    }

    // segmentsRef must point to `normalized` so that the parent echo-back
    // of the same normalized value hits the `segments === segmentsRef.current`
    // early-return in the sync effect and avoids a redundant DOM rewrite.
    segmentsRef.current = normalizedSegments;
    onChange(normalizedSegments);
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
