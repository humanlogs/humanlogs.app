"use client";

import { useTranslations } from "@/components/locale-provider";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  TranscriptionDetail,
  TranscriptionSegment,
} from "../../../hooks/use-transcriptions";
import { useEditorStateRegister } from "./editor-state-context";
import { EditorAPI } from "./hooks/editor-api-tiptap";
import { SaveStatus, useAutoSave } from "./hooks/use-auto-save";
import { Speaker } from "./hooks/use-speaker-actions";
import "./index.css";
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
  hasWriteAccess,
  hasListenAccess,
  transcription,
  onSaveStatusChange,
}: {
  hasWriteAccess: boolean;
  hasListenAccess: boolean;
  transcription: TranscriptionDetail;
  onSaveStatusChange?: (status: SaveStatus) => void;
}) => {
  const t = useTranslations("editor");
  const editorAPIRef = useRef<EditorAPI>(null);
  const [segments] = useState<TranscriptionSegment[]>(
    transcription.transcription?.words ?? [],
  );
  const [speakers, setSpeakers] = useState<Speaker[]>(() =>
    initSpeakers(
      transcription.transcription?.speakers ?? [],
      transcription.transcription?.words ?? [],
    ),
  );

  // Auto-save with debounce
  const { saveStatus, onChange } = useAutoSave({
    transcriptionId: transcription.id,
    editorAPIRef: editorAPIRef as { current: EditorAPI },
    speakers,
  });

  // Propagate save status changes to parent
  useEffect(() => {
    onSaveStatusChange?.(saveStatus);
  }, [saveStatus, onSaveStatusChange]);

  // Provide getter for current editor state and register with context
  const getState = useCallback(() => {
    return { segments: editorAPIRef.current?.getSegments() || [], speakers };
  }, [speakers]);
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
        editorAPIRef={editorAPIRef}
        segments={segments}
        speakers={speakers}
        onChange={(newSegments) => {
          editorAPIRef.current?.setSegments(newSegments);
          onChange();
        }}
        onSpeakersChange={setSpeakers}
        audioFileEncryption={transcription.audioFileEncryption}
        hasWriteAccess={hasWriteAccess}
        hasListenAccess={hasListenAccess}
      />
    </div>
  );
};
