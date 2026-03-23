"use client";

import { useState } from "react";
import {
  TranscriptionDetail,
  TranscriptionSegment,
} from "../../../hooks/use-api";
import "./index.css";
import { Speaker } from "./hooks/use-speaker-actions";
import { TranscriptEditorContent } from "./transcript-editor-content";

/**
 * Ensures every speakerId referenced in segments has a speaker entry with a name.
 * Fills in "Speaker N" (order of first appearance) for any missing entries.
 */
function initSpeakers(
  raw: Speaker[],
  segments: TranscriptionSegment[],
): Speaker[] {
  const ids: string[] = [];
  for (const seg of segments) {
    if (seg.speakerId && !ids.includes(seg.speakerId)) ids.push(seg.speakerId);
  }
  return ids.map((id, i) => {
    const existing = raw.find((s) => s.id === id);
    return existing?.name ? existing : { id, name: `Speaker ${i + 1}` };
  });
}

export const TranscriptEditor = ({
  transcription,
}: {
  transcription: TranscriptionDetail;
}) => {
  const [segments, setSegments] = useState<TranscriptionSegment[]>(
    transcription.transcription?.words ?? [],
  );
  const [speakers, setSpeakers] = useState<Speaker[]>(() =>
    initSpeakers(
      transcription.transcription?.speakers ?? [],
      transcription.transcription?.words ?? [],
    ),
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
        speakers={speakers}
        onChange={setSegments}
        onSpeakersChange={setSpeakers}
      />
    </div>
  );
};
