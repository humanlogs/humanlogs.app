/**
 * Editor API Abstraction Layer
 *
 * This file provides a clean API for all editor DOM operations.
 * Later, this can be swapped to work with a virtual scrolling implementation
 * without changing the consuming code.
 */

import { TranscriptionSegment } from "@/hooks/use-transcriptions";
import { RefObject } from "react";
import { domToSegments } from "../utils/dom";
import { segmentsToHtml } from "../utils/html";
import { getSelectionOffsets, restoreSelection } from "../utils/selection";

export interface EditorAPI {
  ready(): boolean;
  isFocused(): boolean;

  // Focus management
  blur(): void;
  focus(segmentIndex?: number, selectContent?: boolean): void;

  // Event handlers
  addEventListener(
    event: "focus" | "blur" | "scroll",
    handler: () => void,
    options?: AddEventListenerOptions,
  ): () => void;

  // Segment navigation
  getSegmentNode(segmentIndex?: number): HTMLElement | null;
  getSegmentBounds(segmentIndex: number): DOMRect | null;
  setActiveSegment(segmentIndex: number): void;
  clearActiveSegments(): void;

  // Content management
  setSegments(segments: TranscriptionSegment[]): void;
  getSegments(): TranscriptionSegment[];

  // Selection management
  getSelectionOffsets(): { start: number; end: number } | null;
  restoreSelection(start: number, end: number): void;

  // Speaker positions
  getSpeakerPositions(): Array<{
    speakerId: string;
    index: number;
    top: number;
  }>;

  // Scrolling
  scrollTo(segmentIndex?: number): void;

  // DOM queries (will be deprecated later with virtual scrolling)
  querySelectorAll(selector: string): NodeListOf<Element>;
  querySelector(selector: string): Element | null;
  getEditorElement(): HTMLElement | null;

  // Measurements
  getBoundingClientRect(): DOMRect;

  // Observers
  observeResize(callback: () => void): () => void;
  observeMutations(callback: () => void): () => void;
}

/**
 * Creates an EditorAPI instance from a ref.
 * For now, this wraps a real contentEditable div.
 * Later, it can be replaced with a virtual implementation.
 */
export function createEditorAPI(
  editorRef: RefObject<HTMLDivElement | null>,
): EditorAPI {
  // Store the current segments internally for reference during parsing
  let currentSegments: TranscriptionSegment[] = [];

  return {
    ready() {
      return editorRef.current !== null;
    },

    isFocused() {
      return editorRef.current?.contains(document.activeElement) || false;
    },

    blur() {
      if (this.isFocused()) {
        editorRef.current?.blur();
      }
    },

    focus(segmentIndex?: number, selectContent: boolean = false) {
      if (!editorRef.current) return;

      if (segmentIndex !== undefined) {
        // Calculate character offset for this segment
        let charOffset = 0;
        for (let i = 0; i < segmentIndex && i < currentSegments.length; i++) {
          charOffset += currentSegments[i].text.length;
        }

        const segmentLength = currentSegments[segmentIndex]?.text.length ?? 0;

        // Create range at segment position
        const range = document.createRange();
        const walker = document.createTreeWalker(
          editorRef.current,
          NodeFilter.SHOW_TEXT,
          null,
        );

        let currentOffset = 0;
        let startNode: Node | null = null;
        let startOffset = 0;
        let endNode: Node | null = null;
        let endOffset = 0;

        let node: Node | null;
        while ((node = walker.nextNode())) {
          const nodeLength = node.textContent?.length ?? 0;

          // Find start position
          if (!startNode && currentOffset + nodeLength >= charOffset) {
            startNode = node;
            startOffset = charOffset - currentOffset;
          }

          // Find end position (only if we want to select content)
          if (
            selectContent &&
            !endNode &&
            currentOffset + nodeLength >= charOffset + segmentLength
          ) {
            endNode = node;
            endOffset = charOffset + segmentLength - currentOffset;
            break;
          }

          currentOffset += nodeLength;

          // If not selecting content, we can break early
          if (!selectContent && startNode) {
            break;
          }
        }

        if (startNode) {
          range.setStart(startNode, startOffset);

          if (selectContent && endNode) {
            // Select the entire segment
            range.setEnd(endNode, endOffset);
          } else {
            // Just place caret at start
            range.collapse(true);
          }

          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      }

      editorRef.current.focus();
    },

    addEventListener(event, handler, options) {
      const editor = editorRef.current;
      if (!editor) return () => {};

      editor.addEventListener(event, handler, options);
      return () => editor.removeEventListener(event, handler);
    },

    getSegmentNode(segmentIndex?) {
      if (!editorRef.current) return null;

      if (segmentIndex !== undefined) {
        console.warn(
          `[EditorAPI] getSegmentNode with index is no longer supported in plain-text mode`,
        );
        return null;
      }

      // Return the entire editor as the active "segment"
      return editorRef.current;
    },

    getSegmentBounds(segmentIndex) {
      if (
        !editorRef.current ||
        segmentIndex < 0 ||
        segmentIndex >= currentSegments.length
      ) {
        return null;
      }

      // Calculate character offset for this segment
      let charOffset = 0;
      for (let i = 0; i < segmentIndex; i++) {
        charOffset += currentSegments[i].text.length;
      }

      const segmentLength = currentSegments[segmentIndex].text.length;

      // Create range for the segment
      const range = document.createRange();
      const walker = document.createTreeWalker(
        editorRef.current,
        NodeFilter.SHOW_TEXT,
        null,
      );

      let currentOffset = 0;
      let startNode: Node | null = null;
      let startOffset = 0;
      let endNode: Node | null = null;
      let endOffset = 0;

      let node: Node | null;
      while ((node = walker.nextNode())) {
        const nodeLength = node.textContent?.length ?? 0;

        // Find start position
        if (!startNode && currentOffset + nodeLength > charOffset) {
          startNode = node;
          startOffset = charOffset - currentOffset;
        }

        // Find end position
        if (
          !endNode &&
          currentOffset + nodeLength >= charOffset + segmentLength
        ) {
          endNode = node;
          endOffset = charOffset + segmentLength - currentOffset;
          break;
        }

        currentOffset += nodeLength;
      }

      if (!startNode || !endNode) {
        return null;
      }

      try {
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);
        return range.getBoundingClientRect();
      } catch (e) {
        console.warn("[EditorAPI] Failed to get segment bounds", e);
        return null;
      }
    },

    setActiveSegment(segmentIndex) {
      // In the new approach, we don't use CSS classes for active segments
      // This will be handled by a positioned overlay div
      // For now, just focus the segment
      this.focus(segmentIndex);
    },

    clearActiveSegments() {
      // No-op in the new approach
    },

    setSegments(segments) {
      if (!editorRef.current) return;

      const sel = getSelectionOffsets(editorRef.current);
      currentSegments = segments;
      editorRef.current.innerHTML = segmentsToHtml(segments);

      if (sel !== null) {
        restoreSelection(editorRef.current, sel.start, sel.end);
      }
    },

    getSegments() {
      if (!editorRef.current) return [];
      return domToSegments(editorRef.current, currentSegments);
    },

    getSelectionOffsets() {
      if (!editorRef.current) return null;
      return getSelectionOffsets(editorRef.current);
    },

    restoreSelection(start, end) {
      if (!editorRef.current) return;
      restoreSelection(editorRef.current, start, end);
    },

    getSpeakerPositions() {
      const editor = editorRef.current;
      if (!editor || currentSegments.length === 0) return [];

      const result: Array<{
        speakerId: string;
        index: number;
        top: number;
      }> = [];

      let charOffset = 0;
      let prevSpeakerId: string | null = null;
      let paragraphBreak = false;
      let turnIndex = 0;

      for (let i = 0; i < currentSegments.length; i++) {
        const seg = currentSegments[i];

        if (seg.type === "spacing") {
          if (seg.text.includes("\n\n")) paragraphBreak = true;
          charOffset += seg.text.length;
          continue;
        }

        if (seg.type !== "word" || !seg.speakerId) {
          charOffset += seg.text.length;
          continue;
        }

        if (seg.speakerId !== prevSpeakerId || paragraphBreak) {
          // Create a range for this character position
          const range = document.createRange();
          const walker = document.createTreeWalker(
            editor,
            NodeFilter.SHOW_TEXT,
            null,
          );

          let currentOffset = 0;
          let targetNode: Node | null = null;
          let targetOffset = 0;

          let node: Node | null;
          while ((node = walker.nextNode())) {
            const nodeLength = node.textContent?.length ?? 0;
            if (currentOffset + nodeLength > charOffset) {
              targetNode = node;
              targetOffset = charOffset - currentOffset;
              break;
            }
            currentOffset += nodeLength;
          }

          if (targetNode) {
            try {
              range.setStart(targetNode, targetOffset);
              range.setEnd(
                targetNode,
                Math.min(targetOffset + 1, targetNode.textContent?.length ?? 0),
              );

              const rect = range.getBoundingClientRect();
              const editorRect = editor.getBoundingClientRect();
              const top = rect.top - editorRect.top + rect.height / 2;

              result.push({
                speakerId: seg.speakerId,
                index: turnIndex++,
                top,
              });
            } catch (e) {
              console.warn(
                "[EditorAPI] Failed to create range for speaker position",
                e,
              );
            }
          }

          prevSpeakerId = seg.speakerId;
          paragraphBreak = false;
        }

        charOffset += seg.text.length;
      }

      return result;
    },

    scrollTo(segmentIndex?) {
      if (!editorRef.current) return;

      if (segmentIndex !== undefined) {
        // Calculate character offset for this segment
        let charOffset = 0;
        for (let i = 0; i < segmentIndex && i < currentSegments.length; i++) {
          charOffset += currentSegments[i].text.length;
        }

        // Create range at segment position and scroll into view
        const range = document.createRange();
        const walker = document.createTreeWalker(
          editorRef.current,
          NodeFilter.SHOW_TEXT,
          null,
        );

        let currentOffset = 0;
        let targetNode: Node | null = null;
        let targetOffset = 0;

        let node: Node | null;
        while ((node = walker.nextNode())) {
          const nodeLength = node.textContent?.length ?? 0;
          if (currentOffset + nodeLength >= charOffset) {
            targetNode = node;
            targetOffset = charOffset - currentOffset;
            break;
          }
          currentOffset += nodeLength;
        }

        if (targetNode && targetNode.parentElement) {
          targetNode.parentElement.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "nearest",
          });
        }
      } else {
        // Scroll to current cursor position
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();

          if (rect.height > 0) {
            // Create a temporary element at the cursor position to scroll to
            const tempEl = document.createElement("span");
            range.insertNode(tempEl);
            tempEl.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
              inline: "nearest",
            });
            tempEl.remove();
          }
        }
      }
    },

    querySelectorAll(selector) {
      return editorRef.current?.querySelectorAll(selector) ?? ([] as any);
    },

    querySelector(selector) {
      return editorRef.current?.querySelector(selector) ?? null;
    },

    getEditorElement() {
      return editorRef.current;
    },

    getBoundingClientRect() {
      return editorRef.current?.getBoundingClientRect() ?? new DOMRect();
    },

    observeResize(callback) {
      const editor = editorRef.current;
      if (!editor) return () => {};

      const ro = new ResizeObserver(callback);
      ro.observe(editor);
      return () => ro.disconnect();
    },

    observeMutations(callback) {
      const editor = editorRef.current;
      if (!editor) return () => {};

      const mo = new MutationObserver(callback);
      mo.observe(editor, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      return () => mo.disconnect();
    },
  };
}

/**
 * Hook version of createEditorAPI for convenience
 */
export function useEditorAPI(
  editorRef: RefObject<HTMLDivElement | null>,
): EditorAPI {
  // We don't use useMemo here because the API object methods
  // already close over editorRef, and the ref is stable
  return createEditorAPI(editorRef);
}
