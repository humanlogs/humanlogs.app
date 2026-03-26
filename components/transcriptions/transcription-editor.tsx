"use client";

import { TranscriptionDetail } from "../../hooks/use-api";
import { AudioProvider } from "./editor/audio-context";
import { TranscriptEditor } from "./editor/editor";
import { SaveStatus } from "./editor/hooks/use-auto-save";

type TranscriptionEditorProps = {
  transcription: TranscriptionDetail;
  onSaveStatusChange?: (status: SaveStatus) => void;
};

export function TranscriptionEditor({
  transcription,
  onSaveStatusChange,
}: TranscriptionEditorProps) {
  return (
    <AudioProvider>
      <div>
        <TranscriptEditor
          transcription={transcription}
          onSaveStatusChange={onSaveStatusChange}
        />
      </div>
    </AudioProvider>
  );
}
