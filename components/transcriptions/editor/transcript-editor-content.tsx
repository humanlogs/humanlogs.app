"use client";

import { useRef } from "react";
import { TranscriptionSegment } from "../../../hooks/use-api";
import { EditorToolbar } from "./components/editor-toolbar";
import { SpeakerColumn } from "./components/speaker-column";
import { SpeakerRenameDialog } from "./components/speaker-rename-dialog";
import { useBracketWrap } from "./hooks/use-bracket-wrap";
import { useEditorSync } from "./hooks/use-editor-sync";
import { useFormat } from "./hooks/use-format";
import { Speaker, useSpeakerActions } from "./hooks/use-speaker-actions";
import { useSpeakerPositions } from "./hooks/use-speaker-positions";
import { InteractiveAudio } from "./interactive-audio";

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
  // Tracks the last segments value that produced the current DOM so redundant
  // re-renders are skipped when the parent echoes back what we already set.
  const segmentsRef = useRef<TranscriptionSegment[] | null>(null);

  const { handleInput, handleBeforeInput, handleUndoKeyDown } = useEditorSync(
    editorRef,
    segmentsRef,
    segments,
    onChange,
  );
  const { applyFormat, handleKeyDown: handleFormatKeyDown } =
    useFormat(editorRef);
  const { handleKeyDown: handleBracketWrapKeyDown } = useBracketWrap();
  const speakerPositions = useSpeakerPositions(editorRef, segments);
  const { renameSpeaker, changeSpeakerForTurn } = useSpeakerActions({
    speakers,
    segments,
    onSpeakersChange,
    onSegmentsChange: onChange,
  });

  return (
    <>
      <SpeakerRenameDialog />
      <div className="flex flex-col h-full space-y-4 py-6 z-0 relative">
        <EditorToolbar applyFormat={applyFormat} />
        <InteractiveAudio segments={segments} id={id} />
        <div className="flex flex-row px-6 gap-4 flex-1 z-10">
          <SpeakerColumn
            positions={speakerPositions}
            speakers={speakers}
            segments={segments}
            onRenameSpeaker={renameSpeaker}
            onChangeSpeakerForTurn={changeSpeakerForTurn}
          />
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            spellCheck
            className="flex-1 text-base leading-relaxed overflow-y-auto focus:outline-none"
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
    </>
  );
}
