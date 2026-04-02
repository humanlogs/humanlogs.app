"use client";

import { TranscriptionSegment } from "@/hooks/use-transcriptions";
import { Editor, EditorContent } from "@tiptap/react";
import { useRef } from "react";
import { EditorAPI } from "./api";
import { useTiptapEditor } from "./hooks/use-tiptap-editor";

interface TranscriptEditorContentProps {
  editorAPI: EditorAPI;
  segments: TranscriptionSegment[];
  speakers: Array<{ id: string; name?: string }>;
  onChange: (segments: TranscriptionSegment[]) => void;
  hasWriteAccess: boolean;
  onSelectionUpdate: (selection: { from: number; to: number }) => void;
  onUpdate: () => void;
}

export function TranscriptEditorContentTipTap({
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
    segments, // Replace \n\n with space for better handling in Tiptap
    onChange,
    editable: hasWriteAccess,
    onSelectionUpdate: onSelectionUpdate,
    onUpdate: onUpdate,
  });

  const tiptapEditorRef = useRef<Editor | null>(null);

  if (!tiptapEditorRef.current && tiptapEditor) {
    tiptapEditorRef.current = tiptapEditor;
    editorAPI.init(tiptapEditorRef, segmentsRef, speakers);
  }

  return <EditorContent editor={tiptapEditor} />;
}
