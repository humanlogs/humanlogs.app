"use client";

import { useEffect, useRef, useState } from "react";
import { TranscriptionSegment } from "@/hooks/use-transcriptions";
import { useAudio } from "../audio-context";
import { EditorAPI } from "./editor-api";

/**
 * Two-way sync between editor cursor and audio playback:
 * 1. When caret moves in editor → seek audio to segment's start time (works for both words and spacing)
 * 2. When audio time changes → highlight all segments within ±0.1s of current time (CSS only)
 */
export function useAudioSync(
  editorAPI: EditorAPI,
  segments: TranscriptionSegment[],
) {
  const { currentTime, seekTo } = useAudio();
  const lastSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const lastSyncTimeRef = useRef<number>(0);
  const [activeSegmentIndices, setActiveSegmentIndices] = useState<number[]>(
    [],
  );

  // Part 1: Caret position → Audio seek
  useEffect(() => {
    if (!editorAPI.ready()) return;

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
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
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
            i + 1 < segments.length
          ) {
            const nextSegment = segments[i + 1];
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
  }, [editorAPI, segments, seekTo]);

  // Part 2: Audio time → Highlight segments
  // Highlights all segments whose expanded time range includes currentTime
  useEffect(() => {
    if (!editorAPI.ready()) return;

    // Remove all previous highlights (legacy support for span-based mode)
    const previousHighlights = editorAPI.querySelectorAll(
      ".word-span.active, .spacing-span.active",
    );
    previousHighlights.forEach((el) => el.classList.remove("active"));

    // Find all segments that should be highlighted
    const indicesToHighlight: number[] = [];
    segments.forEach((segment, index) => {
      if (segment.start !== undefined && segment.end !== undefined) {
        const expandedStart = segment.start;
        const expandedEnd = segment.end;

        if (currentTime >= expandedStart && currentTime <= expandedEnd) {
          indicesToHighlight.push(index);
        }
      }
    });

    setActiveSegmentIndices(indicesToHighlight);
  }, [currentTime, editorAPI, segments]);

  return {
    activeSegmentIndices,
  };
}
