"use client";

import { EditorContent } from "@tiptap/react";
import { useEffect, useRef } from "react";
import { TranscriptionSegment } from "../../../hooks/use-transcriptions";
import { EditorAPI } from "./hooks/editor-api-tiptap";
import { useTiptapEditor } from "./hooks/use-tiptap-editor";

interface TranscriptEditorContentProps {
  editorAPIRef: React.MutableRefObject<EditorAPI | null>;
  segments: TranscriptionSegment[];
  onChange: (segments: TranscriptionSegment[]) => void;
  hasWriteAccess: boolean;
  onSelectionUpdate: (selection: { from: number; to: number }) => void;
  onUpdate: () => void;
}

export function TranscriptEditorContentTipTap({
  segments,
  onChange,
  hasWriteAccess,
  editorAPIRef,
  onSelectionUpdate,
  onUpdate,
}: TranscriptEditorContentProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  // Initialize Tiptap editor with transaction events
  const { editor: tiptapEditor, api: editorAPI } = useTiptapEditor({
    segments,
    onChange,
    editable: hasWriteAccess,
    onSelectionUpdate: onSelectionUpdate,
    onUpdate: onUpdate,
  });

  // Update editorRef to point to Tiptap's DOM element once it's ready
  useEffect(() => {
    if (tiptapEditor && editorRef.current) {
      const tiptapElement = tiptapEditor.view.dom as HTMLElement;
      // Store a reference that RemoteCursors can use
      (editorRef.current as any)._tiptapElement = tiptapElement;
    }
  }, [tiptapEditor]);

  editorAPIRef.current = editorAPI;

  return <EditorContent editor={tiptapEditor} />;
}
