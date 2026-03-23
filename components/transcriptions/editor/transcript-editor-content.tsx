"use client";

import { useRef } from "react";
import { TranscriptionSegment } from "../../../hooks/use-api";
import { EditorToolbar } from "./components/editor-toolbar";
import { useEditorSync } from "./hooks/use-editor-sync";
import { useFormat } from "./hooks/use-format";
import { InteractiveAudio } from "./interactive-audio";

interface TranscriptEditorContentProps {
  segments: TranscriptionSegment[];
  id: string;
  onChange: (segments: TranscriptionSegment[]) => void;
}

export function TranscriptEditorContent({
  segments,
  id,
  onChange,
}: TranscriptEditorContentProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  // Tracks the last segments value that produced the current DOM so redundant
  // re-renders are skipped when the parent echoes back what we already set.
  const segmentsRef = useRef<TranscriptionSegment[] | null>(null);

  const { handleInput } = useEditorSync(
    editorRef,
    segmentsRef,
    segments,
    onChange,
  );
  const { applyFormat, handleKeyDown } = useFormat(editorRef);

  return (
    <div className="flex flex-col h-full space-y-4">
      <EditorToolbar applyFormat={applyFormat} />
      <InteractiveAudio segments={segments} id={id} />
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        className="flex-1 px-6 text-base leading-relaxed overflow-y-auto focus:outline-none"
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        data-placeholder="Start typing…"
      />
    </div>
  );
}
