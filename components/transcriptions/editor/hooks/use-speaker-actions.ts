"use client";

import { useCallback, useState } from "react";
import { TranscriptionSegment } from "@/hooks/use-transcriptions";
import { EditorAPI } from "./editor-api-tiptap";

export interface Speaker {
  id: string;
  name?: string;
}

/**
 * Resolves a display name for a speaker.
 * Falls back to "Speaker N" using order of first appearance in segments.
 */
export function getSpeakerLabel(
  speakerId: string,
  speakers: Speaker[],
): string {
  const found = speakers.find((s) => s.id === speakerId);
  if (found?.name) return found.name;

  // Build order-of-appearance index as fallback
  const idx = speakers.map((a) => a.id).indexOf(speakerId);
  return `Speaker ${idx >= 0 ? idx + 1 : "?"}`;
}

/**
 * Returns the speakerId of the N-th speaker turn (0-based) in segments.
 * A "turn" starts whenever the speakerId differs from the previous word's,
 * OR a \n\n spacing segment appears between words of the same speaker.
 */
function speakerIdForTurn(
  turnIndex: number,
  segments: TranscriptionSegment[],
): string | null {
  let turn = -1;
  let prev: string | null = null;
  let paragraphBreak = false;
  for (const seg of segments) {
    if (seg.type === "spacing" && seg.text.includes("\n")) {
      paragraphBreak = true;
      continue;
    }
    if (seg.type !== "word" || !seg.speakerId) continue;
    if (seg.speakerId !== prev || paragraphBreak) {
      turn++;
      prev = seg.speakerId;
      paragraphBreak = false;
      if (turn === turnIndex) return seg.speakerId;
    }
  }
  return null;
}

/**
 * Returns the range of segment indices that belong to the N-th speaker turn.
 * Turn boundaries follow the same paragraph-break-aware logic as speakerIdForTurn.
 */
function segmentRangeForTurn(
  turnIndex: number,
  segments: TranscriptionSegment[],
): { start: number; end: number } | null {
  let turn = -1;
  let prev: string | null = null;
  let rangeStart = -1;
  let paragraphBreak = false;
  let paragraphBreakIdx = -1;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.type === "spacing" && seg.text.includes("\n\n")) {
      if (turn === turnIndex) paragraphBreakIdx = i;
      paragraphBreak = true;
      continue;
    }
    if (seg.type !== "word" || !seg.speakerId) continue;
    if (seg.speakerId !== prev || paragraphBreak) {
      if (turn === turnIndex && rangeStart >= 0) {
        // End the turn just before the paragraph break (or before this word)
        const end = paragraphBreakIdx >= 0 ? paragraphBreakIdx - 1 : i - 1;
        return { start: rangeStart, end };
      }
      turn++;
      prev = seg.speakerId;
      paragraphBreak = false;
      paragraphBreakIdx = -1;
      if (turn === turnIndex) rangeStart = i;
    }
  }

  if (turn === turnIndex && rangeStart >= 0) {
    return { start: rangeStart, end: segments.length - 1 };
  }
  return null;
}

interface UseSpeakerActionsOptions {
  speakers: Speaker[];
  segments: TranscriptionSegment[];
  onSpeakersChange: (speakers: Speaker[]) => void;
  onSegmentsChange: (segments: TranscriptionSegment[]) => void;
}

export function useSpeakerActions({
  speakers,
  segments,
  onSpeakersChange,
  onSegmentsChange,
}: UseSpeakerActionsOptions) {
  const [renaming, setRenaming] = useState<string | null>(null); // speakerId being renamed

  /** Rename a speaker (updates speakers list; segment speakerIds stay the same) */
  const renameSpeaker = useCallback(
    (speakerId: string, name: string) => {
      const existing = speakers.find((s) => s.id === speakerId);
      if (existing) {
        onSpeakersChange(
          speakers.map((s) => (s.id === speakerId ? { ...s, name } : s)),
        );
      } else {
        onSpeakersChange([...speakers, { id: speakerId, name }]);
      }
    },
    [speakers, onSpeakersChange],
  );

  /**
   * Change the speakerId for all segments in a given turn (by turn index).
   * If targetSpeakerId is null a new speaker is created.
   */
  const changeSpeakerForTurn = useCallback(
    (turnIndex: number, targetSpeakerId: string | null) => {
      const currentId = speakerIdForTurn(turnIndex, segments);
      if (!currentId) return;

      let newId = targetSpeakerId;
      let newSpeakers = speakers;

      if (!newId) {
        // Create a new speaker
        newId = `speaker-${Date.now()}`;
        const nextN = speakers.length + 1;
        newSpeakers = [...speakers, { id: newId, name: `Speaker ${nextN}` }];
        onSpeakersChange(newSpeakers);
      }

      const range = segmentRangeForTurn(turnIndex, segments);
      if (!range) return;

      const updatedSegments = segments.map((seg, i) => {
        if (i < range.start || i > range.end) return seg;
        if (seg.speakerId !== currentId) return seg;
        return { ...seg, speakerId: newId as string };
      });

      onSegmentsChange(updatedSegments);
    },
    [speakers, segments, onSpeakersChange, onSegmentsChange],
  );

  return { renaming, setRenaming, renameSpeaker, changeSpeakerForTurn };
}
