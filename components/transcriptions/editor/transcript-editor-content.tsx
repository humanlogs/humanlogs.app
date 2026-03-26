"use client";

import { useEffect, useRef, useState } from "react";
import { TranscriptionSegment } from "../../../hooks/use-api";
import { EditorToolbar } from "./components/editor-toolbar";
import { SearchHighlights } from "./components/search-highlights";
import { SpeakerColumn } from "./components/speaker-column";
import { SpeakerRenameDialog } from "./components/speaker-rename-dialog";
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

interface TranscriptEditorContentProps {
  segments: TranscriptionSegment[];
  speakers: Speaker[];
  id: string;
  onChange: (segments: TranscriptionSegment[]) => void;
  onSpeakersChange: (speakers: Speaker[]) => void;
}

export function TranscriptEditorContent({
  segments,
  speakers,
  id,
  onChange,
  onSpeakersChange,
}: TranscriptEditorContentProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // Tracks the last segments value that produced the current DOM so redundant
  // re-renders are skipped when the parent echoes back what we already set.
  const segmentsRef = useRef<TranscriptionSegment[] | null>(null);

  // Audio controls from InteractiveAudio
  const [audioControls, setAudioControls] = useState<AudioControls | null>(
    null,
  );

  // Debug log when audio controls are set
  useEffect(() => {
    console.log("[TranscriptEditor] Audio controls updated:", audioControls);
  }, [audioControls]);

  const { handleInput, handleBeforeInput, handleUndoKeyDown } = useEditorSync(
    editorRef,
    segmentsRef,
    segments,
    onChange,
  );
  const {
    applyFormat,
    handleKeyDown: handleFormatKeyDown,
    activeFormats,
  } = useFormat(editorRef);
  const { handleKeyDown: handleBracketWrapKeyDown } = useBracketWrap();

  // Navigation mode
  useNavigationMode(editorRef, segments, audioControls);

  const speakerPositions = useSpeakerPositions(editorRef, segments);
  const { renameSpeaker, changeSpeakerForTurn } = useSpeakerActions({
    speakers,
    segments,
    onSpeakersChange,
    onSegmentsChange: onChange,
  });

  // Search and replace
  const searchReplace = useSearchReplace(segments, onChange);

  // Search highlights
  const highlights = useSearchHighlights(
    editorRef,
    segments,
    searchReplace.matches,
    searchReplace.currentMatchIndex,
  );

  // Two-way sync between cursor position and audio playback
  useAudioSync(editorRef, segments);

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
        {/* Sticky top section */}
        <div className="space-y-4 pt-6">
          <InteractiveAudio
            segments={segments}
            id={id}
            onAudioControlsReady={setAudioControls}
          />
          <EditorToolbar
            applyFormat={applyFormat}
            activeFormats={activeFormats}
            searchReplace={searchReplace}
            searchInputRef={searchInputRef}
          />
        </div>

        {/* Scrollable content area */}
        <div className="flex flex-row px-6 gap-4 flex-1 pt-4 pb-6">
          <SpeakerColumn
            positions={speakerPositions}
            speakers={speakers}
            segments={segments}
            onRenameSpeaker={renameSpeaker}
            onChangeSpeakerForTurn={changeSpeakerForTurn}
          />
          <div className="flex-1 relative overflow-y-auto">
            <SearchHighlights highlights={highlights} />
            <div
              ref={editorRef}
              contentEditable
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
    </>
  );
}
