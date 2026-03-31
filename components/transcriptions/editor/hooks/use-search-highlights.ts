"use client";

import { useEffect, useState } from "react";
import { TranscriptionSegment } from "@/hooks/use-transcriptions";
import { SearchMatch } from "./use-search-replace";
import { EditorAPI } from "./editor-api";

export interface HighlightPosition {
  top: number;
  left: number;
  width: number;
  height: number;
  isCurrent: boolean;
}

export function useSearchHighlights(
  editorAPI: EditorAPI,
  segments: TranscriptionSegment[],
  matches: SearchMatch[],
  currentMatchIndex: number,
) {
  const [highlights, setHighlights] = useState<HighlightPosition[]>([]);

  useEffect(() => {
    if (!editorAPI.ready() || matches.length === 0) {
      setHighlights([]);
      return;
    }

    const updateHighlights = () => {
      const editor = editorAPI.getEditorElement();
      if (!editor) {
        setHighlights([]);
        return;
      }

      const editorRect = editorAPI.getBoundingClientRect();
      const positions: HighlightPosition[] = [];

      matches.forEach((match, matchIdx) => {
        // Calculate absolute character offset for this match
        let charOffset = 0;
        for (let i = 0; i < match.segmentIndex; i++) {
          charOffset += segments[i].text.length;
        }
        charOffset += match.matchIndex;

        const matchEnd = charOffset + match.length;

        // Create range for the match
        const range = document.createRange();
        const walker = document.createTreeWalker(
          editor,
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
          if (!endNode && currentOffset + nodeLength >= matchEnd) {
            endNode = node;
            endOffset = matchEnd - currentOffset;
            break;
          }

          currentOffset += nodeLength;
        }

        if (startNode && endNode) {
          try {
            range.setStart(startNode, startOffset);
            range.setEnd(endNode, endOffset);

            const rect = range.getBoundingClientRect();

            if (rect.width > 0 && rect.height > 0) {
              positions.push({
                top: rect.top - editorRect.top,
                left: rect.left - editorRect.left,
                width: rect.width,
                height: rect.height,
                isCurrent: matchIdx === currentMatchIndex,
              });
            }
          } catch (e) {
            console.error("Error calculating highlight position:", e);
          }
        }
      });

      setHighlights(positions);
    };

    // Initial update
    updateHighlights();

    // Update on scroll
    const cleanupScroll = editorAPI.addEventListener("scroll", updateHighlights);

    // Update on window events
    const handleWindowEvent = () => updateHighlights();
    window.addEventListener("scroll", handleWindowEvent, true);
    window.addEventListener("resize", handleWindowEvent);

    // Update on editor mutations
    const cleanupMutations = editorAPI.observeMutations(updateHighlights);

    return () => {
      cleanupScroll();
      cleanupMutations();
      window.removeEventListener("scroll", handleWindowEvent, true);
      window.removeEventListener("resize", handleWindowEvent);
    };
  }, [editorAPI, segments, matches, currentMatchIndex]);

  return highlights;
}
