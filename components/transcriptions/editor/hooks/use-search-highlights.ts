"use client";

import { RefObject, useEffect, useState } from "react";
import { TranscriptionSegment } from "@/hooks/use-transcriptions";
import { SearchMatch } from "./use-search-replace";

export interface HighlightPosition {
  top: number;
  left: number;
  width: number;
  height: number;
  isCurrent: boolean;
}

export function useSearchHighlights(
  editorRef: RefObject<HTMLDivElement | null>,
  segments: TranscriptionSegment[],
  matches: SearchMatch[],
  currentMatchIndex: number,
) {
  const [highlights, setHighlights] = useState<HighlightPosition[]>([]);

  useEffect(() => {
    if (!editorRef.current || matches.length === 0) {
      setHighlights([]);
      return;
    }

    const editor = editorRef.current;
    const positions: HighlightPosition[] = [];

    // Walk through the editor DOM to find text nodes
    const walker = document.createTreeWalker(
      editor,
      NodeFilter.SHOW_TEXT,
      null,
    );

    let segmentIndex = 0;
    const currentNode: Node | null = walker.nextNode();

    matches.forEach((match, matchIdx) => {
      // Skip to the correct segment
      while (segmentIndex < match.segmentIndex && currentNode) {
        if (segments[segmentIndex].type === "word") {
          // Intentionally empty - just advancing through segments
        }
        segmentIndex++;
      }

      if (segmentIndex !== match.segmentIndex) return;

      // Find the text node containing this match
      const segment = segments[match.segmentIndex];
      if (segment.type !== "word") return;

      const matchStart = match.matchIndex;
      const matchEnd = match.matchIndex + match.length;

      // Calculate position using Range API
      try {
        const range = document.createRange();

        // Find the correct text node
        const textNode = findTextNodeForSegment(editor, match.segmentIndex);

        if (!textNode) return;

        range.setStart(textNode, matchStart);
        range.setEnd(textNode, matchEnd);

        const rect = range.getBoundingClientRect();
        const editorRect = editor.getBoundingClientRect();

        if (rect.width > 0 && rect.height > 0) {
          positions.push({
            top: rect.top - editorRect.top + editor.scrollTop,
            left: rect.left - editorRect.left + editor.scrollLeft,
            width: rect.width,
            height: rect.height,
            isCurrent: matchIdx === currentMatchIndex,
          });
        }
      } catch (e) {
        console.error("Error calculating highlight position:", e);
      }
    });

    setHighlights(positions);
  }, [editorRef, segments, matches, currentMatchIndex]);

  return highlights;
}

// Helper function to find the text node for a specific segment
function findTextNodeForSegment(
  editor: HTMLElement,
  segmentIndex: number,
): Text | null {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);

  let currentSegmentIndex = -1;
  let node: Node | null = walker.nextNode();

  while (node) {
    // Check if this text node belongs to a word segment
    const parentElement = node.parentElement;
    if (parentElement && node.textContent) {
      currentSegmentIndex++;

      if (currentSegmentIndex === segmentIndex) {
        return node as Text;
      }
    }

    node = walker.nextNode();
  }

  return null;
}
