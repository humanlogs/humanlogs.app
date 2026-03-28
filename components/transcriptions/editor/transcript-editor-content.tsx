"use client";

import { useEffect, useRef, useState } from "react";
import { TranscriptionSegment } from "../../../hooks/use-transcriptions";
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
import { createPortal } from "react-dom";
import { cn } from "../../../lib/utils";
import { SpeakerOptionsData } from "../dialogs/speaker-options-dialog";

interface TranscriptEditorContentProps {
  segments: TranscriptionSegment[];
  speakers: Speaker[];
  id: string;
  onChange: (segments: TranscriptionSegment[]) => void;
  onSpeakersChange: (speakers: Speaker[]) => void;
  audioFileEncryption?: string;
}

export function TranscriptEditorContent({
  segments,
  speakers,
  id,
  onChange,
  onSpeakersChange,
  audioFileEncryption,
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

  useEffect(() => {
    return;
    window.addEventListener("scroll", () => {
      document
        .getElementById("header-sub-portal-container")
        ?.classList.toggle("border-b", window.scrollY > 0);
    });
  }, []);

  return (
    <>
      <SpeakerRenameDialog />
      <div className="flex flex-col h-full">
        {/* Sticky top section */}
        {createPortal(
          <div id="header-sub-portal-container" className={cn("space-y-2")}>
            <InteractiveAudio
              segments={segments}
              id={id}
              audioFileEncryption={audioFileEncryption}
              onAudioControlsReady={setAudioControls}
            />
            <div className="px-4 pb-2">
              <EditorToolbar
                applyFormat={applyFormat}
                activeFormats={activeFormats}
                searchReplace={searchReplace}
                searchInputRef={searchInputRef}
                audioControls={audioControls}
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
          />
          <div className="flex-1 px-2">
            <div className="relative">
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
      </div>
    </>
  );
}
