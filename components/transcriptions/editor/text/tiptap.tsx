"use client";

import { TranscriptionSegment } from "@/hooks/use-transcriptions";
import { Editor, EditorContent } from "@tiptap/react";
import { useEffect, useRef } from "react";
import { EditorAPI } from "./api";
import { useTiptapEditor } from "./hooks/use-tiptap-editor";

interface TranscriptEditorContentProps {
  transcriptionId: string;
  editorAPI: EditorAPI;
  segments: TranscriptionSegment[];
  speakers: Array<{ id: string; name?: string }>;
  onChange: (segments: TranscriptionSegment[]) => void;
  hasWriteAccess: boolean;
  onSelectionUpdate: (editor: Editor) => void;
  onUpdate: () => void;
}

export function TranscriptEditorContentTipTap({
  transcriptionId,
  editorAPI,
  segments,
  speakers,
  onChange,
  hasWriteAccess,
  onSelectionUpdate,
  onUpdate,
}: TranscriptEditorContentProps) {
  // Initialize Tiptap editor with transaction events
  const { editor: tiptapEditor, segmentsRef } = useTiptapEditor({
    transcriptionId,
    segments, // Replace \n\n with space for better handling in Tiptap
    onChange,
    editable: hasWriteAccess,
    onSelectionUpdate: onSelectionUpdate,
    onUpdate: onUpdate,
  });

  const tiptapEditorRef = useRef<Editor | null>(null);

  if (!tiptapEditorRef.current && tiptapEditor) {
    tiptapEditorRef.current = tiptapEditor;
    editorAPI.init(tiptapEditorRef, segmentsRef as any, speakers);
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden">
      <EditorContent
        editor={tiptapEditor}
        className="tiptap w-full min-w-0 max-w-full overflow-x-hidden"
      />
    </div>
  );
}
