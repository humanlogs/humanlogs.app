"use client";

import { TranscriptionDetail } from "../../hooks/use-api";
import { AudioProvider } from "./editor/audio-context";
import { TranscriptEditor } from "./editor/editor";
import { InteractiveAudio } from "./editor/interactive-audio";

type TranscriptionEditorProps = {
  transcription: TranscriptionDetail;
};

export function TranscriptionEditor({
  transcription,
}: TranscriptionEditorProps) {
  return (
    <AudioProvider>
      <div>
        <TranscriptEditor transcription={transcription} />
      </div>
    </AudioProvider>
  );
}
