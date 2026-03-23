"use client";

import { RefObject, useCallback, useEffect } from "react";
import { TranscriptionSegment } from "../../../../hooks/use-api";
import { normalizeEditorSegments } from "../use-normalize-editor-segments";
import { domToSegments } from "../utils/dom";
import { segmentsToHtml } from "../utils/html";
import { getSelectionOffsets, restoreSelection } from "../utils/selection";

export function useEditorSync(
  editorRef: RefObject<HTMLDivElement | null>,
  segmentsRef: { current: TranscriptionSegment[] | null },
  segments: TranscriptionSegment[],
  onChange: (segments: TranscriptionSegment[]) => void,
) {
  // Sync DOM when segments prop changes from the outside.
  // We never rewrite innerHTML on input events so the browser keeps its native
  // undo stack and handles Enter/newlines itself.
  useEffect(() => {
    if (!editorRef.current) return;
    if (segments === segmentsRef.current) return;

    const isFirstRender = segmentsRef.current === null;
    const normalized = normalizeEditorSegments(segments);

    const sel = !isFirstRender ? getSelectionOffsets(editorRef.current) : null;

    editorRef.current.innerHTML = segmentsToHtml(normalized);
    segmentsRef.current = normalized;

    if (sel !== null) restoreSelection(editorRef.current, sel.start, sel.end);

    // If normalization changed anything, propagate the canonical form back up.
    if (normalized !== segments) {
      onChange(normalized);
    }
    // editorRef and segmentsRef are stable refs — not needed in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments]);

  // Parse the current DOM and notify the parent.
  //
  // Normally we leave the DOM untouched so the browser keeps its native undo
  // stack and Enter/newlines work naturally.
  //
  // However, when normalization produces different *text* content (e.g. a long
  // pause becomes "(pause)", a speaker boundary becomes "\n\n") we must rewrite
  // the DOM so the editor visually reflects the canonical representation.
  // We set segmentsRef to the raw segments first (they match the current DOM)
  // so that a parent echo-back of the *same* normalized value still triggers
  // the sync effect and the DOM is updated.
  const handleInput = useCallback(() => {
    if (!editorRef.current) return;
    const raw = domToSegments(editorRef.current);
    const normalized = normalizeEditorSegments(raw);

    const rawText = raw.map((s) => s.text).join("");
    const normalizedText = normalized.map((s) => s.text).join("");
    const contentChanged = rawText !== normalizedText;

    if (contentChanged) {
      // Normalization modified the visible text — rewrite DOM immediately and
      // restore cursor. This is acceptable because it's a semantic change, not
      // a plain keystroke, so losing the micro-undo entry is fine.
      const sel = getSelectionOffsets(editorRef.current);
      editorRef.current.innerHTML = segmentsToHtml(normalized);
      segmentsRef.current = normalized;
      if (sel !== null) restoreSelection(editorRef.current, sel.start, sel.end);
    } else {
      // No visible text change – keep the native DOM intact so the browser's
      // undo stack (ctrl+z / ctrl+y) is fully preserved.
      // Set segmentsRef to `normalized` (not `raw`) so when the parent echoes
      // the normalized value back through the `segments` prop, the sync effect
      // sees `segments === segmentsRef.current` and does NOT rewrite innerHTML.
      segmentsRef.current = normalized;
    }

    onChange(normalized);
    // editorRef and segmentsRef are stable refs — not needed in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onChange]);

  return { handleInput };
}
