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
  isEncrypted?: boolean;
  aesKey?: string | null;
  aesKeyReady?: boolean;
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
  isEncrypted,
  aesKey,
  aesKeyReady,
  onChange,
  hasWriteAccess,
  onSelectionUpdate,
  onUpdate,
}: TranscriptEditorContentProps) {
  // Initialize Tiptap editor with transaction events
  const { editor: tiptapEditor, segmentsRef } = useTiptapEditor({
    transcriptionId,
    segments, // Replace \n\n with space for better handling in Tiptap
    speakers,
    isEncrypted,
    aesKey,
    aesKeyReady,
    onChange,
    editorAPI,
    editable: hasWriteAccess,
    onSelectionUpdate: onSelectionUpdate,
    onUpdate: onUpdate,
  });

  const tiptapEditorRef = useRef<Editor | null>(null);

  // Wiring the API is a side effect (it emits "ready" to consumers), so it
  // belongs in an effect rather than in the render pass.
  useEffect(() => {
    if (!tiptapEditor || tiptapEditorRef.current) return;
    tiptapEditorRef.current = tiptapEditor;
    editorAPI.init(tiptapEditorRef, segmentsRef as any, speakers);
  }, [tiptapEditor, editorAPI, segmentsRef, speakers]);

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden">
      <EditorContent
        editor={tiptapEditor}
        className="tiptap w-full min-w-0 max-w-full overflow-x-hidden"
      />
    </div>
  );
}
