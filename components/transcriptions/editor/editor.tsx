"use client";

import { useState } from "react";
import {
  TranscriptionDetail,
  TranscriptionSegment,
} from "../../../hooks/use-api";
import "./index.css";
import { TranscriptEditorContent } from "./transcript-editor-content";

export const TranscriptEditor = ({
  transcription,
}: {
  transcription: TranscriptionDetail;
}) => {
  const [segments, setSegments] = useState<TranscriptionSegment[]>(
    transcription.transcription?.words ?? [],
  );

  if (!transcription.transcription) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No transcription content available
      </div>
    );
  }

  return (
    <div className="h-full">
      <TranscriptEditorContent
        id={transcription.id}
        segments={segments}
        onChange={setSegments}
      />
    </div>
  );
};
