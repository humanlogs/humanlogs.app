"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { TranscriptionSegment } from "../../../hooks/use-transcriptions";
import { cn } from "../../../lib/utils";
import { PauseConfigurationData } from "../dialogs/pause-configuration-dialog";
import { SpeakerOptionsData } from "../dialogs/speaker-options-dialog";
import { ActiveSegmentHighlight } from "./components/active-segment-highlight";
import { EditorToolbar } from "./components/editor-toolbar";
import { SearchHighlights } from "./components/search-highlights";
import { SpeakerColumn } from "./components/speaker-column";
import { SpeakerRenameDialog } from "./components/speaker-rename-dialog";
import { RemoteCursors } from "./components/remote-cursors";
import { useOptionalEditorState } from "./editor-state-context";
import { createEditorAPI } from "./hooks/editor-api";
import { useAudioSync } from "./hooks/use-audio-sync";
import { useBracketWrap } from "./hooks/use-bracket-wrap";
import { useEditorSync } from "./hooks/use-editor-sync";
import { useFormat } from "./hooks/use-format";
import { useNavigationMode } from "./hooks/use-navigation-mode";
import { useSearchHighlights } from "./hooks/use-search-highlights";
import { useSearchReplace } from "./hooks/use-search-replace";
import { Speaker, useSpeakerActions } from "./hooks/use-speaker-actions";
import { useSpeakerPositions } from "./hooks/use-speaker-positions";
import { AudioControls, InteractiveAudio } from "./interactive-audio";
import { useTranscriptionCursors } from "../../../hooks/use-transcription-cursors";
import { getSelectionOffsets } from "./utils/selection";

interface TranscriptEditorContentProps {
  segments: TranscriptionSegment[];
  speakers: Speaker[];
  id: string;
  onChange: (segments: TranscriptionSegment[]) => void;
  onSpeakersChange: (speakers: Speaker[]) => void;
  audioFileEncryption?: string;
  hasWriteAccess: boolean;
  hasListenAccess: boolean;
}

// Helper to convert segment index to character offset
function getCharacterOffsetFromSegment(
  segments: TranscriptionSegment[],
  segmentIndex: number,
): number {
  let offset = 0;
  for (let i = 0; i < segmentIndex && i < segments.length; i++) {
    offset += segments[i].text.length;
  }
  return offset;
}

export function TranscriptEditorContent({
  segments,
  speakers,
  id,
  onChange,
  onSpeakersChange,
  audioFileEncryption,
  hasWriteAccess,
  hasListenAccess,
}: TranscriptEditorContentProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // Tracks the last segments value that produced the current DOM so redundant
  // re-renders are skipped when the parent echoes back what we already set.
  const segmentsRef = useRef<TranscriptionSegment[] | null>(null);

  // Create EditorAPI from editorRef
  const editorAPI = useMemo(() => createEditorAPI(editorRef), []);

  // Audio controls from InteractiveAudio
  const [audioControls, setAudioControls] = useState<AudioControls | null>(
    null,
  );

  // Real-time cursor tracking
  const { cursors, updateCursorPosition, isEditLocked, activeEditor } =
    useTranscriptionCursors(id);

  // Check if editing is currently locked by another user
  const editLocked = hasWriteAccess && isEditLocked();
  const currentActiveEditor = activeEditor();
  const effectiveWriteAccess = hasWriteAccess && !editLocked;

  // Track timestamps for selection vs navigation to determine which is most recent
  const lastSelectionChangeRef = useRef<number>(0);
  const lastNavigationChangeRef = useRef<number>(0);
  const prevActiveSegmentRef = useRef<number>(-1);

  // Debug log when audio controls are set
  useEffect(() => {
    console.log("[TranscriptEditor] Audio controls updated:", audioControls);
  }, [audioControls]);

  const { handleInput, handleBeforeInput, handleUndoKeyDown } = useEditorSync(
    editorAPI,
    segmentsRef,
    segments,
    onChange,
  );
  const {
    applyFormat,
    handleKeyDown: handleFormatKeyDown,
    activeFormats,
  } = useFormat(editorAPI);
  const { handleKeyDown: handleBracketWrapKeyDown } = useBracketWrap();

  // Navigation mode
  const { state: navigationState, currentIndex: activeSegmentIndex } =
    useNavigationMode(editorAPI, segments, audioControls);

  const speakerPositions = useSpeakerPositions(editorAPI, segments);
  const { renameSpeaker, changeSpeakerForTurn } = useSpeakerActions({
    speakers,
    segments,
    onSpeakersChange,
    onSegmentsChange: onChange,
  });

  // Track cursor position and emit to other users
  const handleSelectionChange = useCallback(() => {
    if (!editorRef.current || segments.length === 0) return;

    const selection = getSelectionOffsets(editorRef.current);
    if (!selection) return;

    // Update selection timestamp
    lastSelectionChangeRef.current = Date.now();

    // If there's a text selection, use it
    if (selection.start !== selection.end) {
      updateCursorPosition(selection.start, selection.end, hasWriteAccess);
      return;
    }

    // For cursor (no selection), check what's most recent: navigation or selection
    if (navigationState === "navigate" && activeSegmentIndex >= 0) {
      // Compare timestamps
      if (lastNavigationChangeRef.current > lastSelectionChangeRef.current) {
        // Navigation is more recent, use active segment with full word length
        const startOffset = getCharacterOffsetFromSegment(
          segments,
          activeSegmentIndex,
        );
        const segmentLength = segments[activeSegmentIndex]?.text.length || 0;
        updateCursorPosition(
          startOffset,
          startOffset + segmentLength,
          hasWriteAccess,
        );
        return;
      }
    }

    // Use current cursor position from selection
    updateCursorPosition(selection.start, selection.start, hasWriteAccess);
  }, [segments, updateCursorPosition, navigationState, activeSegmentIndex]);

  // Listen for selection changes
  useEffect(() => {
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [handleSelectionChange]);

  // Track navigation mode changes
  useEffect(() => {
    if (navigationState === "navigate" && activeSegmentIndex >= 0) {
      // Check if active segment actually changed
      if (prevActiveSegmentRef.current !== activeSegmentIndex) {
        lastNavigationChangeRef.current = Date.now();
        prevActiveSegmentRef.current = activeSegmentIndex;

        // Emit the active segment position with full word length
        const startOffset = getCharacterOffsetFromSegment(
          segments,
          activeSegmentIndex,
        );
        const segmentLength = segments[activeSegmentIndex]?.text.length || 0;
        updateCursorPosition(
          startOffset,
          startOffset + segmentLength,
          hasWriteAccess,
        );
      }
    }
  }, [navigationState, activeSegmentIndex, segments, updateCursorPosition]);

  // Apply speaker options (modifications, merge, remove)
  const applySpeakerOptions = (options: SpeakerOptionsData) => {
    let updatedSegments = [...segments];

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
    onChange(updatedSegments);
  };

  // Apply pause configuration (add pause markers to spacing segments)
  const applyPauseConfiguration = (config: PauseConfigurationData) => {
    const result: TranscriptionSegment[] = [];

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];

      // Only process spacing segments with timing information
      if (
        seg.type !== "spacing" ||
        seg.start === undefined ||
        seg.end === undefined
      ) {
        result.push(seg);
        continue;
      }

      // Calculate duration
      const duration = seg.end - seg.start;

      // Check if this spacing is between words of the same speaker
      let beforeWord: TranscriptionSegment | undefined;
      let afterWord: TranscriptionSegment | undefined;

      for (let j = i - 1; j >= 0; j--) {
        if (segments[j].type === "word") {
          beforeWord = segments[j];
          break;
        }
      }
      for (let j = i + 1; j < segments.length; j++) {
        if (segments[j].type === "word") {
          afterWord = segments[j];
          break;
        }
      }

      const sameSpeaker =
        beforeWord?.speakerId !== undefined &&
        afterWord?.speakerId !== undefined &&
        beforeWord.speakerId === afterWord.speakerId;

      // Only apply pause markers to pauses within same speaker
      if (!sameSpeaker) {
        result.push(seg);
        continue;
      }

      // Apply pause markers based on duration
      if (duration >= 3) {
        // Long pause (>3s)
        const mid = (seg.start + seg.end) / 2;

        // Add spacing before pause marker
        result.push({
          type: "spacing",
          text: " ",
          start: seg.start,
          end: mid,
          speakerId: seg.speakerId,
        });

        // Add pause marker as a word segment
        result.push({
          type: "word",
          text: config.longPauseMarker,
          start: seg.start,
          end: seg.end,
          speakerId: seg.speakerId,
        });

        // Add spacing after pause marker (with optional double line break)
        result.push({
          type: "spacing",
          text: config.addDoubleLineBreak ? "\n\n" : " ",
          start: mid,
          end: seg.end,
          speakerId: seg.speakerId,
        });
      } else if (duration >= 1) {
        // Short pause (>1s)
        const mid = (seg.start + seg.end) / 2;

        // Add spacing before pause marker
        result.push({
          type: "spacing",
          text: " ",
          start: seg.start,
          end: mid,
          speakerId: seg.speakerId,
        });

        // Add pause marker as a word segment
        result.push({
          type: "word",
          text: config.shortPauseMarker,
          start: seg.start,
          end: seg.end,
          speakerId: seg.speakerId,
        });

        // Add spacing after pause marker
        result.push({
          type: "spacing",
          text: " ",
          start: mid,
          end: seg.end,
          speakerId: seg.speakerId,
        });
      } else {
        // Keep spacing as-is for pauses < 1s
        result.push(seg);
      }
    }

    // Apply changes
    onChange(result);
  };

  // Register operations with editor state context (if available)
  const editorStateContext = useOptionalEditorState();
  useEffect(() => {
    if (editorStateContext) {
      editorStateContext.registerOperations({
        applyPauseConfiguration,
        applySpeakerOptions,
      });
      return () => {
        editorStateContext.unregisterOperations();
      };
    }
  }, [editorStateContext, applyPauseConfiguration, applySpeakerOptions]);

  // Search and replace
  const searchReplace = useSearchReplace(segments, onChange);

  // Search highlights
  const highlights = useSearchHighlights(
    editorAPI,
    segments,
    searchReplace.matches,
    searchReplace.currentMatchIndex,
  );

  // Two-way sync between cursor position and audio playback
  const { activeSegmentIndices } = useAudioSync(editorAPI, segments);

  // Global keyboard shortcuts for search
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Cmd+F / Ctrl+F to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      // Cmd+G / Ctrl+G or F3 for next match (browser standard)
      if (
        ((e.metaKey || e.ctrlKey) && e.key === "g" && !e.shiftKey) ||
        (e.key === "F3" && !e.shiftKey)
      ) {
        e.preventDefault();
        if (searchReplace.matchCount > 0) {
          searchReplace.nextMatch();
        }
        return;
      }

      // Cmd+Shift+G / Ctrl+Shift+G or Shift+F3 for previous match
      if (
        ((e.metaKey || e.ctrlKey) && e.key === "g" && e.shiftKey) ||
        (e.key === "F3" && e.shiftKey)
      ) {
        e.preventDefault();
        if (searchReplace.matchCount > 0) {
          searchReplace.previousMatch();
        }
        return;
      }
    };

    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, [searchReplace]);

  return (
    <>
      <SpeakerRenameDialog />
      <div className="flex flex-col h-full">
        {editLocked && currentActiveEditor && (
          <>
            <div className="mb-2 px-4 py-2 bg-yellow-100 dark:bg-yellow-900/30 border-y border-yellow-300 dark:border-yellow-700 text-sm text-yellow-800 dark:text-yellow-200 fixed w-full z-10">
              <span className="font-semibold">
                {currentActiveEditor.userName}
              </span>{" "}
              is currently editing this transcription
            </div>
            <div className="h-8" />{" "}
            {/* Spacer to prevent content jump due to fixed banner */}
          </>
        )}

        {/* Sticky top section */}
        {createPortal(
          <div id="header-sub-portal-container" className={cn("space-y-2")}>
            {hasListenAccess ? (
              <InteractiveAudio
                segments={segments}
                id={id}
                audioFileEncryption={audioFileEncryption}
                onAudioControlsReady={setAudioControls}
              />
            ) : (
              <div className="pt-2"></div>
            )}
            <div className="px-4 pb-2">
              <EditorToolbar
                applyFormat={applyFormat}
                activeFormats={activeFormats}
                searchReplace={searchReplace}
                searchInputRef={searchInputRef}
                audioControls={audioControls}
                hasWriteAccess={effectiveWriteAccess}
                hasListenAccess={hasListenAccess}
              />
            </div>
          </div>,
          document.getElementById("header-sub-portal")!,
        )}

        {/* Scrollable content area */}
        <div className="flex flex-row px-4 gap-2 flex-1 pb-6 pt-4 pb-16">
          <SpeakerColumn
            positions={speakerPositions}
            speakers={speakers}
            segments={segments}
            onRenameSpeaker={renameSpeaker}
            onChangeSpeakerForTurn={changeSpeakerForTurn}
            onApplySpeakerOptions={applySpeakerOptions}
            readOnly={!effectiveWriteAccess}
          />
          <div className="flex-1 px-2">
            <div className="relative">
              <SearchHighlights highlights={highlights} />
              <ActiveSegmentHighlight
                editorAPI={editorAPI}
                segmentIndex={activeSegmentIndex}
                visible={
                  navigationState === "navigate" && activeSegmentIndex >= 0
                }
              />
              <RemoteCursors cursors={cursors} editorRef={editorRef} />
              <div
                ref={editorRef}
                contentEditable={effectiveWriteAccess}
                suppressContentEditableWarning
                spellCheck
                className="text-base leading-relaxed focus:outline-none relative"
                onBeforeInput={handleBeforeInput}
                onInput={handleInput}
                onKeyDown={(e) => {
                  handleBracketWrapKeyDown(e);
                  handleUndoKeyDown(e);
                  handleFormatKeyDown(e);
                }}
                data-placeholder="Start typing…"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
