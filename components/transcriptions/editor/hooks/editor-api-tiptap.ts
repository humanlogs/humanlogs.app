/**
 * Tiptap-based EditorAPI Implementation
 *
 * This provides the same EditorAPI interface but backed by Tiptap editor
 * instead of a plain contentEditable div. This allows us to leverage
 * Tiptap's transaction system while maintaining compatibility with existing code.
 */

import { TranscriptionSegment } from "@/hooks/use-transcriptions";
import { Editor } from "@tiptap/react";
import { segmentsToHtml } from "../utils/html";

/**
 * Creates an EditorAPI instance backed by a Tiptap editorRef.current.
 */
export function createTiptapEditorAPI(
  editorRef: { current: Editor | null },
  segmentsRef: { current: TranscriptionSegment[] },
): EditorAPI {
  return {
    activeSegmentIndex: -1,
    cachedSpeakerPositions: { scrollTop: 0, positions: [] },

    ready() {
      return editorRef.current !== null;
    },

    isFocused() {
      return editorRef.current?.isFocused ?? false;
    },

    blur() {
      editorRef.current?.commands.blur();
    },

    focus(segmentIndex?: number, selectContent: boolean = false) {
      if (!editorRef.current) return;

      segmentIndex = segmentIndex ?? this.activeSegmentIndex ?? 0;

      if (segmentIndex !== undefined && segmentIndex >= 0) {
        console.log(
          `[TiptapEditorAPI] Focusing segment ${segmentIndex} (selectContent=${selectContent})`,
        );

        // Calculate character offset for this segment
        let charOffset = 0;
        for (
          let i = 0;
          i < segmentIndex && i < segmentsRef.current.length;
          i++
        ) {
          charOffset += segmentsRef.current[i].text.length;
        }

        const segmentLength =
          segmentsRef.current[segmentIndex]?.text.length ?? 0;

        // Use Tiptap's setTextSelection command
        if (selectContent) {
          editorRef.current.commands.setTextSelection({
            from: charOffset + 1, // +1 for Tiptap's 1-based indexing
            to: charOffset + segmentLength + 1,
          });
        } else {
          editorRef.current.commands.setTextSelection(charOffset + 1);
        }
      }

      editorRef.current.commands.focus();
    },

    addEventListener(event, handler, options) {
      // For focus/blur, we can attach to the editorRef.current's DOM element
      const editorElement = editorRef.current?.view.dom;
      if (!editorElement) return () => {};

      editorElement.addEventListener(event, handler, options);
      return () => editorElement.removeEventListener(event, handler);
    },

    getSegments() {
      return segmentsRef.current || [];
    },

    getSegmentNode(segmentIndex?) {
      // In Tiptap, we don't have individual segment nodes in the same way
      // Return the editor DOM element
      return editorRef.current?.view.dom as HTMLElement | null;
    },

    getSegmentBounds(segmentIndex) {
      if (
        !editorRef.current ||
        segmentIndex < 0 ||
        segmentIndex >= segmentsRef.current.length
      ) {
        return null;
      }

      // Calculate character offset for this segment
      let charOffset = 0;
      for (let i = 0; i < segmentIndex; i++) {
        charOffset += segmentsRef.current[i].text.length;
      }

      const segmentLength = segmentsRef.current[segmentIndex].text.length;

      // Use Tiptap's coordsAtPos to get the bounds
      try {
        const from = editorRef.current.view.coordsAtPos(charOffset + 1);
        const to = editorRef.current.view.coordsAtPos(
          charOffset + segmentLength + 1,
        );

        return new DOMRect(
          from.left,
          from.top,
          to.right - from.left,
          to.bottom - from.top,
        );
      } catch (e) {
        console.error("[TiptapEditorAPI] Error getting segment bounds:", e);
        return null;
      }
    },

    setActiveSegment(segmentIndex) {
      this.activeSegmentIndex = segmentIndex;
    },

    clearActiveSegments() {
      this.activeSegmentIndex = -1;
    },

    setSegments(segments) {
      segmentsRef.current = segments;
      if (editorRef.current) {
        const html = segmentsToHtml(segments);
        editorRef.current.commands.setContent(html, { emitUpdate: false });
      }
    },

    getSelectionOffsets() {
      if (!editorRef.current) return null;

      const { from, to } = editorRef.current.state.selection;

      // Tiptap uses 1-based indexing, convert to 0-based
      return {
        start: from - 1,
        end: to - 1,
      };
    },

    restoreSelection(start, end) {
      if (!editorRef.current) return;

      // Convert 0-based to 1-based for Tiptap
      editorRef.current.commands.setTextSelection({
        from: start + 1,
        to: end + 1,
      });
    },

    getSpeakerPositions() {
      if (!editorRef.current) return [];

      const positions: Array<{
        speakerId: string;
        index: number;
        top: number;
        charOffset: number;
        charPos: number;
      }> = [];

      // Check if we need to recalculate:
      // Case 1: scrolled since last calculation (compare scrollTop to cached positions)
      if (
        this.cachedSpeakerPositions &&
        this.cachedSpeakerPositions.scrollTop ===
          editorRef.current.view.dom.scrollTop
      ) {
        try {
          // Case 2: first or last cached position changed position
          const firstNewPos = editorRef.current.view.coordsAtPos(
            this.cachedSpeakerPositions.positions[0]?.charOffset + 1 || 1,
          );
          const lastNewPos = editorRef.current.view.coordsAtPos(
            this.cachedSpeakerPositions.positions.slice(-1)[0]?.charOffset +
              1 || 1,
          );

          if (
            firstNewPos.top ===
              this.cachedSpeakerPositions.positions[0]?.charPos &&
            lastNewPos.top ===
              this.cachedSpeakerPositions.positions.slice(-1)[0]?.charPos
          ) {
            // No need to recalculate, return cached positions
            return this.cachedSpeakerPositions.positions;
          }
        } catch (e) {
          console.error(
            "[TiptapEditorAPI] Error checking cached speaker positions:",
            e,
          );
          // If there's an error (e.g. content changed and offsets are invalid), fall back to recalculating
        }
      }

      // Track which speakers we've seen
      const seenSpeakers = new Set<string>();
      let charOffset = 0;
      const editorRect = editorRef.current.view.dom.getBoundingClientRect();

      for (let i = 0; i < segmentsRef.current.length; i++) {
        const seg = segmentsRef.current[i];

        if (
          seg.type === "word" &&
          (i === 0 || segmentsRef.current[i - 1].text.includes("\n\n"))
        ) {
          seenSpeakers.add(seg.speakerId || "?");

          try {
            // Get absolute coordinates from Tiptap
            const coords = editorRef.current.view.coordsAtPos(charOffset + 1);
            // Calculate relative position from editor top
            const relativeTop =
              coords.top -
              editorRect.top +
              editorRef.current.view.dom.scrollTop;

            const visible =
              relativeTop >= window.scrollY - window.innerHeight &&
              relativeTop <= window.scrollY + window.innerHeight * 2;

            if (visible) {
              positions.push({
                speakerId: seg.speakerId || "?",
                index: i,
                top: relativeTop,
                charOffset: charOffset,
                charPos: coords.top,
              });
            }
          } catch (e) {
            console.error("[TiptapEditorAPI] Error getting position:", e);
          }
        }

        charOffset += seg.text.length;
      }

      this.cachedSpeakerPositions = {
        scrollTop: editorRef.current.view.dom.scrollTop,
        positions,
      };
      return positions;
    },

    getEditorElement() {
      return (editorRef.current?.view.dom as HTMLElement) ?? null;
    },

    getBoundingClientRect() {
      return (
        editorRef.current?.view.dom.getBoundingClientRect() ?? new DOMRect()
      );
    },

    observeResize(callback) {
      const element = editorRef.current?.view.dom;
      if (!element) return () => {};

      const observer = new ResizeObserver(callback);
      observer.observe(element);
      return () => observer.disconnect();
    },

    observeMutations(callback) {
      const element = editorRef.current?.view.dom;
      if (!element) return () => {};

      const observer = new MutationObserver(callback);
      observer.observe(element, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      return () => observer.disconnect();
    },

    getRangeRect(start, end) {
      if (!editorRef.current) return null;

      try {
        const view = editorRef.current.view;
        // TipTap uses 1-based positions
        const from = start + 1;
        const to = end + 1;

        // Get DOM nodes and offsets for the range
        const startPos = view.domAtPos(from);
        const endPos = view.domAtPos(to);

        if (startPos && endPos) {
          const range = document.createRange();
          range.setStart(startPos.node, startPos.offset);
          range.setEnd(endPos.node, endPos.offset);
          return range.getBoundingClientRect();
        }
      } catch (e) {
        console.error("[TiptapEditorAPI] Error getting range rect:", e);
      }

      return null;
    },
  };
}

export interface EditorAPI {
  activeSegmentIndex: number | null;
  cachedSpeakerPositions: {
    scrollTop: number;
    positions: Array<{
      speakerId: string;
      index: number;
      top: number;
      charOffset: number;
      charPos: number;
    }>;
  };

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

  // DOM queries (will be deprecated later with virtual scrolling)
  getEditorElement(): HTMLElement | null;

  // Measurements
  getBoundingClientRect(): DOMRect;

  // Observers
  observeResize(callback: () => void): () => void;
  observeMutations(callback: () => void): () => void;

  // Range measurements
  getRangeRect(start: number, end: number): DOMRect | null;
}
