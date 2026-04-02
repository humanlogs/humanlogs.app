"use client";

import { useEffect, useState } from "react";
import { EditorAPI } from "./editor-api-tiptap";
import { SearchMatch } from "./use-search-replace";

export interface HighlightPosition {
  top: number;
  left: number;
  width: number;
  height: number;
  isCurrent: boolean;
}

export function useSearchHighlights(
  editorAPI: EditorAPI,
  matches: SearchMatch[],
  currentMatchIndex: number,
) {
  const [highlights, setHighlights] = useState<HighlightPosition[]>([]);

  useEffect(() => {
    if (!editorAPI?.ready() || matches.length === 0) {
      setHighlights([]);
      return;
    }

    const updateHighlights = () => {
      if (!editorAPI?.ready()) {
        setHighlights([]);
        return;
      }

      const editorRect = editorAPI.getBoundingClientRect();
      const positions: HighlightPosition[] = [];

      // Pre-compute cumulative character offsets for each segment (performance optimization)
      const segments = editorAPI.getSegments();
      const segmentOffsets: number[] = [];
      let cumulativeOffset = 0;
      for (let i = 0; i < segments.length; i++) {
        segmentOffsets[i] = cumulativeOffset;
        cumulativeOffset += segments[i].text.length;
      }

      matches.forEach((match, matchIdx) => {
        // Use pre-computed offset instead of recalculating for each match
        const charOffset =
          segmentOffsets[match.segmentIndex] + match.matchIndex;
        const matchEnd = charOffset + match.length;

        // Use EditorAPI to get the bounding rect for this range
        const rect = editorAPI.getRangeRect(charOffset, matchEnd);

        if (rect && rect.width > 0 && rect.height > 0) {
          positions.push({
            top: rect.top - editorRect.top,
            left: rect.left - editorRect.left,
            width: rect.width,
            height: rect.height,
            isCurrent: matchIdx === currentMatchIndex,
          });
        }
      });

      setHighlights(positions);
    };

    // Debounced version for event handlers (500ms)
    let debounceTimer: NodeJS.Timeout;
    const debouncedUpdateHighlights = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(updateHighlights, 500);
    };

    // Initial update (immediate, no debounce)
    updateHighlights();

    // Update on scroll (debounced)
    const cleanupScroll = editorAPI.addEventListener(
      "scroll",
      debouncedUpdateHighlights,
    );

    // Update on window events (debounced)
    const handleWindowEvent = () => debouncedUpdateHighlights();
    window.addEventListener("scroll", handleWindowEvent, true);
    window.addEventListener("resize", handleWindowEvent);

    // Update on editor mutations (debounced)
    const cleanupMutations = editorAPI.observeMutations(
      debouncedUpdateHighlights,
    );

    return () => {
      clearTimeout(debounceTimer);
      cleanupScroll();
      cleanupMutations();
      window.removeEventListener("scroll", handleWindowEvent, true);
      window.removeEventListener("resize", handleWindowEvent);
    };
  }, [editorAPI, matches, currentMatchIndex]);

  return highlights;
}
