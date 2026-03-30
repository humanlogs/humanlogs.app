import { RefObject } from "react";

/**
 * Selects the currently active segment (marked with .active-segment class)
 * and focuses the editor. Returns true if a segment was found and selected.
 */
export function selectActiveSegmentAndFocus(
  editorRef: RefObject<HTMLDivElement | null>,
): boolean {
  const domElement = editorRef.current?.querySelector(".active-segment");
  if (domElement) {
    const range = document.createRange();
    range.selectNodeContents(domElement);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  // Focus after selection to avoid scroll messing up the position of the segment in the viewport
  editorRef.current?.focus();
  return !!domElement;
}

/**
 * Selects a specific segment by index and focuses the editor.
 * Returns true if the segment was found and selected.
 */
export function selectSegmentByIndexAndFocus(
  editorRef: RefObject<HTMLDivElement | null>,
  currentIndex: number,
): boolean {
  const domElement = editorRef.current?.querySelector(
    `[data-index="${currentIndex}"]`,
  );
  if (domElement) {
    const range = document.createRange();
    range.selectNodeContents(domElement);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  // Focus after selection to avoid scroll messing up the position of the segment in the viewport
  editorRef.current?.focus();
  return !!domElement;
}
