"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranscriptionCursors } from "../../../hooks/use-transcription-cursors";
import { TranscriptionSegment } from "../../../hooks/use-transcriptions";
import { cn } from "../../../lib/utils";
import { PauseConfigurationData } from "../dialogs/pause-configuration-dialog";
import { SpeakerOptionsData } from "../dialogs/speaker-options-dialog";
import { ActiveSegmentHighlight } from "./components/active-segment-highlight";
import { EditorToolbar } from "./components/editor-toolbar";
import { RemoteCursors } from "./components/remote-cursors";
import { SearchHighlights } from "./components/search-highlights";
import { SpeakerColumn } from "./components/speaker-column";
import { SpeakerRenameDialog } from "./components/speaker-rename-dialog";
import { useOptionalEditorState } from "./editor-state-context";
import { EditorAPI } from "./hooks/editor-api-tiptap";
import { useAudioSync } from "./hooks/use-audio-sync";
import { useBracketWrap } from "./hooks/use-bracket-wrap";
import { useFormat } from "./hooks/use-format";
import { useNavigationMode } from "./hooks/use-navigation-mode";
import { useSearchHighlights } from "./hooks/use-search-highlights";
import { useSearchReplace } from "./hooks/use-search-replace";
import { Speaker, useSpeakerActions } from "./hooks/use-speaker-actions";
import { AudioControls, InteractiveAudio } from "./interactive-audio";
import { TranscriptEditorContentTipTap } from "./transcript-editor-content-tiptap";

interface TranscriptEditorContentProps {
  editorAPIRef: React.MutableRefObject<EditorAPI | null>;
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
  editorAPIRef,
}: TranscriptEditorContentProps) {
  // console.log("Rebuilding");

  const editorRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const recalculateSpeakerRef = useRef<() => void>(() => {});

  // Track timestamps for selection vs navigation to determine which is most recent
  const lastSelectionChangeRef = useRef<number>(0);
  const lastNavigationChangeRef = useRef<number>(0);
  const prevActiveSegmentRef = useRef<number>(-1);

  // Audio controls from InteractiveAudio
  const [audioControls, setAudioControls] = useState<AudioControls | null>(
    null,
  );

  // Real-time cursor tracking
  const { cursors, updateCursorPosition } = useTranscriptionCursors(id);

  // Debug log when audio controls are set
  useEffect(() => {
    console.log("[TranscriptEditor] Audio controls updated:", audioControls);
  }, [audioControls]);

  // Note: We don't use useEditorSync with Tiptap - it manages content through its own transaction system
  const {
    applyFormat,
    handleKeyDown: handleFormatKeyDown,
    activeFormats,
  } = useFormat(editorAPIRef.current!);
  const { handleKeyDown: handleBracketWrapKeyDown } = useBracketWrap();

  // Navigation mode
  const { state: navigationState, currentIndex: activeSegmentIndex } =
    useNavigationMode(editorAPIRef as { current: EditorAPI }, audioControls);

  const { renameSpeaker, changeSpeakerForTurn } = useSpeakerActions({
    speakers,
    segments,
    onSpeakersChange,
    onSegmentsChange: onChange,
  });

  // Track cursor position and emit to other users
  const handleSelectionChange = useCallback(() => {
    if (!editorAPIRef.current || segments.length === 0) return;

    const selection = editorAPIRef.current?.getSelectionOffsets();
    if (!selection) return;

    // Update selection timestamp
    lastSelectionChangeRef.current = Date.now();

    // Get selection offsets (Tiptap uses 1-based, we need 0-based)
    const start = selection.start;
    const end = selection.end;

    // If there's a text selection, use it
    if (start !== end) {
      updateCursorPosition(start, end, hasWriteAccess);
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
    updateCursorPosition(start, start, hasWriteAccess);
  }, [
    segments,
    updateCursorPosition,
    navigationState,
    activeSegmentIndex,
    hasWriteAccess,
  ]);

  // Listen for selection changes - Tiptap handles this through onSelectionUpdate
  // No need for document.selectionchange listener anymore

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
  const searchReplace = useSearchReplace(
    editorAPIRef as { current: EditorAPI },
    onChange,
  );

  // Search highlights
  const highlights = useSearchHighlights(
    editorAPIRef.current!,
    searchReplace.matches,
    searchReplace.currentMatchIndex,
  );

  // Two-way sync between cursor position and audio playback
  useAudioSync(editorAPIRef.current!);

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
        {false && (
          <>
            <div className="mb-2 px-4 py-2 bg-yellow-100 dark:bg-yellow-900/30 border-y border-yellow-300 dark:border-yellow-700 text-sm text-yellow-800 dark:text-yellow-200 fixed w-full z-10">
              <span className="font-semibold">{"Someone"}</span> is currently
              editing this transcription
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
                editorAPIRef={editorAPIRef as { current: EditorAPI }}
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
                hasWriteAccess={hasWriteAccess}
                hasListenAccess={hasListenAccess}
              />
            </div>
          </div>,
          document.getElementById("header-sub-portal")!,
        )}

        {/* Scrollable content area */}
        <div className="flex flex-row px-4 gap-2 flex-1 pb-6 pt-4 pb-16">
          <SpeakerColumn
            recalculateSpeakerRef={recalculateSpeakerRef}
            speakers={speakers}
            editorAPIRef={editorAPIRef as { current: EditorAPI }}
            onRenameSpeaker={renameSpeaker}
            onChangeSpeakerForTurn={changeSpeakerForTurn}
            onApplySpeakerOptions={applySpeakerOptions}
            readOnly={!hasWriteAccess}
          />
          <div className="flex-1 px-2">
            <div className="relative">
              <SearchHighlights highlights={highlights} />
              <ActiveSegmentHighlight
                editorAPIRef={editorAPIRef as { current: EditorAPI }}
                segmentIndex={activeSegmentIndex}
                visible={
                  navigationState === "navigate" && activeSegmentIndex >= 0
                }
              />
              <RemoteCursors cursors={cursors} editorRef={editorRef} />
              <div
                ref={editorRef}
                onKeyDown={(e) => {
                  handleBracketWrapKeyDown(e);
                  handleFormatKeyDown(e);
                }}
              >
                <TranscriptEditorContentTipTap
                  segments={segments}
                  editorAPIRef={editorAPIRef}
                  onChange={onChange}
                  onSelectionUpdate={handleSelectionChange}
                  onUpdate={() => {
                    console.log("[TranscriptEditor] Tiptap content update");
                    recalculateSpeakerRef.current &&
                      recalculateSpeakerRef.current();
                  }}
                  hasWriteAccess={hasWriteAccess}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
