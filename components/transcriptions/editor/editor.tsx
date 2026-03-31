"use client";

import { useEffect, useState, useCallback } from "react";
import {
  TranscriptionDetail,
  TranscriptionSegment,
} from "../../../hooks/use-transcriptions";
import { SaveStatus, useAutoSave } from "./hooks/use-auto-save";
import { Speaker } from "./hooks/use-speaker-actions";
import "./index.css";
import { TranscriptEditorContent } from "./transcript-editor-content";
import { useEditorStateRegister } from "./editor-state-context";
import { useTranslations } from "@/components/locale-provider";

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
  onSaveStatusChange,
}: {
  transcription: TranscriptionDetail;
  onSaveStatusChange?: (status: SaveStatus) => void;
}) => {
  const hasWriteAccess =
    transcription.isOwner || transcription.role === "write";
  const hasListenAccess =
    transcription.isOwner ||
    transcription.role === "read+listen" ||
    transcription.role === "write";
  const t = useTranslations("editor");
  const [segments, setSegments] = useState<TranscriptionSegment[]>(
    transcription.transcription?.words ?? [],
  );
  const [speakers, setSpeakers] = useState<Speaker[]>(() =>
    initSpeakers(
      transcription.transcription?.speakers ?? [],
      transcription.transcription?.words ?? [],
    ),
  );

  // Auto-save with debounce
  const { saveStatus } = useAutoSave({
    transcriptionId: transcription.id,
    segments,
    speakers,
  });

  // Propagate save status changes to parent
  useEffect(() => {
    onSaveStatusChange?.(saveStatus);
  }, [saveStatus, onSaveStatusChange]);

  // Provide getter for current editor state and register with context
  const getState = useCallback(() => {
    return { segments, speakers };
  }, [segments, speakers]);

  useEditorStateRegister(getState);

  if (!transcription.transcription) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        {t("content.noContentAvailable")}
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
        audioFileEncryption={transcription.audioFileEncryption}
        hasWriteAccess={hasWriteAccess}
        hasListenAccess={hasListenAccess}
      />
    </div>
  );
};
