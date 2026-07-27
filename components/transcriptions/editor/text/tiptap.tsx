"use client";

import { TranscriptionSegment } from "@/hooks/use-transcriptions";
import { Editor, EditorContent } from "@tiptap/react";
import { useRef } from "react";
import { EditorAPI } from "./api";
import { useTiptapEditor } from "./hooks/use-tiptap-editor";

interface TranscriptEditorContentProps {
  transcriptionId: string;
  editorAPI: EditorAPI;
  segments: TranscriptionSegment[];
  speakers: Array<{ id: string; name?: string }>;
  isEncrypted?: boolean;
  aesKey?: string | null;
  onChange: (segments: TranscriptionSegment[]) => void;
  hasWriteAccess: boolean;
  onSelectionUpdate: (editor: Editor) => void;
}

export function TranscriptEditorContentTipTap({
  transcriptionId,
  editorAPI,
  segments,
  speakers,
  isEncrypted,
  aesKey,
  onChange,
  hasWriteAccess,
  onSelectionUpdate,
}: TranscriptEditorContentProps) {
  const { editor: tiptapEditor, segmentsRef } = useTiptapEditor({
    transcriptionId,
    segments,
    isEncrypted,
    aesKey,
    onChange,
    editorAPI,
    editable: hasWriteAccess,
    onSelectionUpdate,
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
