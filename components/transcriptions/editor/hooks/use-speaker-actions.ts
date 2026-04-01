"use client";

import { TranscriptionSegment } from "@/hooks/use-transcriptions";
import { useCallback, useState } from "react";
import { SpeakerOptionsData } from "../../dialogs/speaker-options-dialog";
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
  return segments[turnIndex]?.speakerId ?? null;
}

interface UseSpeakerActionsOptions {
  speakers: Speaker[];
  editorAPI: EditorAPI;
  onSpeakersChange: (speakers: Speaker[]) => void;
  onSegmentsChange: (segments: TranscriptionSegment[]) => void;
}

export function useSpeakerActions({
  speakers,
  editorAPI,
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
      const currentId = speakerIdForTurn(turnIndex, editorAPI.getSegments());
      console.log(
        "[SpeakerActions] Changing speaker for turn",
        turnIndex,
        "from",
        currentId,
        "to",
        targetSpeakerId,
      );
      if (!currentId || !targetSpeakerId) return;

      let newId = targetSpeakerId;
      let newSpeakers = speakers;

      if (!newId) {
        // Create a new speaker
        newId = `speaker-${Date.now()}`;
        const nextN = speakers.length + 1;
        newSpeakers = [...speakers, { id: newId, name: `Speaker ${nextN}` }];
        onSpeakersChange(newSpeakers);
      }

      const updatedSegments = editorAPI.getSegments();
      let i = turnIndex;
      if (
        updatedSegments[i - 1]?.type === "spacing" &&
        updatedSegments[i - 1].speakerId === currentId
      ) {
        if (updatedSegments[i - 1])
          updatedSegments[i - 1].speakerId = targetSpeakerId; // skip following segments with target speakerId to avoid unnecessary updates
      }
      while (
        updatedSegments[i]?.speakerId === currentId &&
        !updatedSegments[i].text.includes("\n\n")
      ) {
        i++;
        if (updatedSegments[i]) updatedSegments[i].speakerId = targetSpeakerId; // skip following segments with target speakerId to avoid unnecessary updates
      }

      onSegmentsChange(updatedSegments);
    },
    [speakers, editorAPI, onSpeakersChange, onSegmentsChange],
  );

  // Apply speaker options (modifications, merge, remove)
  const applySpeakerOptions = (options: SpeakerOptionsData) => {
    let updatedSegments = [...editorAPI.getSegments()];

    // Apply text modifications to speaker's segments
    if (options.modification !== "none") {
      updatedSegments = updatedSegments.map((seg) => {
        if (seg.speakerId !== options.speakerId) return seg;

        let newText = seg.text;

        // Apply text transformations
        switch (options.modification) {
          case "uppercase":
            newText = seg.text.toUpperCase();
            break;
          case "lowercase":
            newText = seg.text.toLowerCase();
            break;
          case "parenthesis":
            newText = `(${seg.text})`;
            break;
        }

        // Apply formatting modifiers
        const newModifiers = [...(seg.modifiers || [])];
        if (options.modification === "bold" && !newModifiers.includes("b")) {
          newModifiers.push("b");
        } else if (
          options.modification === "italic" &&
          !newModifiers.includes("i")
        ) {
          newModifiers.push("i");
        } else if (
          options.modification === "underline" &&
          !newModifiers.includes("u")
        ) {
          newModifiers.push("u");
        }

        return {
          ...seg,
          text: newText,
          modifiers:
            newModifiers.length > 0
              ? (newModifiers as ("b" | "i" | "u" | "s")[])
              : seg.modifiers,
        };
      });
    }

    // Remove content if requested
    if (options.removeContent) {
      updatedSegments = updatedSegments.filter(
        (seg) => seg.speakerId !== options.speakerId,
      );
    }

    // Merge speaker if requested
    if (options.mergeToSpeakerId && !options.removeContent) {
      updatedSegments = updatedSegments.map((seg) => {
        if (seg.speakerId === options.speakerId) {
          return { ...seg, speakerId: options.mergeToSpeakerId as string };
        }
        return seg;
      });

      // Keep the speaker in the speakers list for undo support (Ctrl+Z)
      // Don't remove it from the array
    }

    // Apply changes
    onSegmentsChange(updatedSegments);
  };

  return {
    renaming,
    setRenaming,
    renameSpeaker,
    changeSpeakerForTurn,
    applySpeakerOptions,
  };
}
