"use client";

import { useEffect, useState } from "react";
import {
  TranscriptionDetail,
  TranscriptionSegment,
} from "../../../hooks/use-api";
import "./index.css";
import { SaveStatus, useAutoSave } from "./hooks/use-auto-save";
import { Speaker } from "./hooks/use-speaker-actions";
import { TranscriptEditorContent } from "./transcript-editor-content";
import { LocalVersionModal } from "../dialogs/local-version-modal";
import {
  getTranscriptionLocally,
  isLocalVersionNewer,
  deleteTranscriptionLocally,
} from "../../../lib/indexeddb";

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
  const [segments, setSegments] = useState<TranscriptionSegment[]>(
    transcription.transcription?.words ?? [],
  );
  const [speakers, setSpeakers] = useState<Speaker[]>(() =>
    initSpeakers(
      transcription.transcription?.speakers ?? [],
      transcription.transcription?.words ?? [],
    ),
  );
  const [showLocalVersionModal, setShowLocalVersionModal] = useState(false);
  const [localData, setLocalData] = useState<{
    segments: TranscriptionSegment[];
    speakers: Speaker[];
    updatedAt: number;
  } | null>(null);

  // Check for local version on mount
  useEffect(() => {
    const checkLocalVersion = async () => {
      const local = await getTranscriptionLocally(transcription.id);

      if (local && transcription.updatedAt) {
        if (isLocalVersionNewer(local.updatedAt, transcription.updatedAt)) {
          // Local version is newer - show modal to let user choose
          setLocalData(local);
          setShowLocalVersionModal(true);
        } else {
          // Server version is newer or same - use server version and update local
          // Clear outdated local data
          await deleteTranscriptionLocally(transcription.id);
        }
      }
    };
    {
      showLocalVersionModal && localData && transcription.updatedAt && (
        <LocalVersionModal
          isOpen={showLocalVersionModal}
          onUseLocal={handleUseLocalVersion}
          onUseServer={handleUseServerVersion}
          localUpdatedAt={localData.updatedAt}
          serverUpdatedAt={transcription.updatedAt}
        />
      );
    }

    checkLocalVersion();
  }, [transcription.id, transcription.updatedAt]);

  const handleUseLocalVersion = () => {
    if (localData) {
      setSegments(localData.segments);
      setSpeakers(localData.speakers);
    }
    setShowLocalVersionModal(false);
  };

  const handleUseServerVersion = async () => {
    // Clear local data and use server version
    await deleteTranscriptionLocally(transcription.id);
    setShowLocalVersionModal(false);
  };

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
