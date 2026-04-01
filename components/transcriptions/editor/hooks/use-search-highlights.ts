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

      matches.forEach((match, matchIdx) => {
        // Calculate absolute character offset for this match
        let charOffset = 0;
        for (let i = 0; i < match.segmentIndex; i++) {
          charOffset += editorAPI.getSegments()[i].text.length;
        }
        charOffset += match.matchIndex;

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

    // Initial update
    updateHighlights();

    // Update on scroll
    const cleanupScroll = editorAPI.addEventListener(
      "scroll",
      updateHighlights,
    );

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
  }, [editorAPI, matches, currentMatchIndex]);

  return highlights;
}
