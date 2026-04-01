"use client";

import { TranscriptionSegment } from "@/hooks/use-transcriptions";
import { useEffect, useRef, useState } from "react";
import { useAudio } from "../audio-context";
import { EditorAPI } from "./editor-api-tiptap";

/**
 * Two-way sync between editor cursor and audio playback:
 * 1. When caret moves in editor → seek audio to segment's start time (works for both words and spacing)
 * 2. When audio time changes → highlight all segments within ±0.1s of current time (CSS only)
 */
export function useAudioSync(editorAPI: EditorAPI) {
  const { currentTime, seekTo } = useAudio();
  const lastSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const lastSyncTimeRef = useRef<number>(0);
  const [activeSegmentIndices, setActiveSegmentIndices] = useState<number[]>(
    [],
  );

  // Part 1: Caret position → Audio seek
  useEffect(() => {
    if (!editorAPI?.ready()) return;

    const handleSelectionChange = () => {
      const selection = editorAPI.getSelectionOffsets();
      if (!selection) return;

      // Only sync if it's a cursor (collapsed selection), not a range
      if (selection.start !== selection.end) return;

      // Save the last selection to avoid redundant updates
      if (
        lastSelectionRef.current?.start === selection.start &&
        lastSelectionRef.current?.end === selection.end
      ) {
        return;
      }
      lastSelectionRef.current = selection;

      // Throttle: don't seek more than once every 200ms to avoid rapid seeks while typing
      const now = Date.now();
      if (now - lastSyncTimeRef.current < 200) {
        return;
      }
      lastSyncTimeRef.current = now;

      // Find which segment the cursor is in
      let charCount = 0;
      for (let i = 0; i < editorAPI.getSegments().length; i++) {
        const segment = editorAPI.getSegments()[i];
        const segmentLength = segment.text.length;
        const segmentStart = charCount;
        const segmentEnd = charCount + segmentLength;

        // Check if cursor is within this segment
        if (selection.start >= segmentStart && selection.start <= segmentEnd) {
          // Special case: if cursor is at the END of a spacing segment,
          // seek to the start of the next word instead
          if (
            segment.type === "spacing" &&
            selection.start === segmentEnd &&
            i + 1 < editorAPI.getSegments().length
          ) {
            const nextSegment = editorAPI.getSegments()[i + 1];
            if (
              nextSegment.type === "word" &&
              nextSegment.start !== undefined
            ) {
              seekTo(nextSegment.start);
              break;
            }
          }

          // Default: seek to segment's start time
          if (segment.start !== undefined) {
            seekTo(segment.start);
          }
          break;
        }

        charCount += segmentLength;
      }
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [editorAPI, seekTo]);

  // Part 2: Audio time → Highlight segments
  // Highlights all segments whose expanded time range includes currentTime
  useEffect(() => {
    if (!editorAPI?.ready()) return;

    // Find all segments that should be highlighted
    const indicesToHighlight: number[] = [];
    editorAPI.getSegments().forEach((segment, index) => {
      if (segment.start !== undefined && segment.end !== undefined) {
        const expandedStart = segment.start;
        const expandedEnd = segment.end;

        if (currentTime >= expandedStart && currentTime <= expandedEnd) {
          indicesToHighlight.push(index);
        }
      }
    });

    setActiveSegmentIndices(indicesToHighlight);
  }, [currentTime, editorAPI]);

  return {
    activeSegmentIndices,
  };
}
