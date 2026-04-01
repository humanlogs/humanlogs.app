"use client";

import { useEffect } from "react";
import { TranscriptionDetail } from "../../hooks/use-transcriptions";
import {
  TutorialWelcomeDialog,
  useTutorialWelcomeModal,
} from "../dialogs/tutorial-welcome-dialog";
import { AudioProvider } from "./editor/audio-context";
import { TranscriptEditor } from "./editor/editor";
import { SaveStatus } from "./editor/hooks/use-auto-save";

type TranscriptionEditorProps = {
  hasWriteAccess: boolean;
  hasListenAccess: boolean;
  transcription: TranscriptionDetail;
  onSaveStatusChange?: (status: SaveStatus) => void;
};

export function TranscriptionEditor({
  hasWriteAccess,
  hasListenAccess,
  transcription,
  onSaveStatusChange,
}: TranscriptionEditorProps) {
  const tutorialWelcomeModal = useTutorialWelcomeModal();

  useEffect(() => {
    // Show tutorial welcome dialog if this is a tutorial and user hasn't seen it yet
    if (transcription.isTutorial) {
      const hasSeenWelcome = localStorage.getItem(
        `tutorial-welcome-seen-${transcription.id}`,
      );
      if (!hasSeenWelcome) {
        tutorialWelcomeModal.open({ transcriptionId: transcription.id });
      }
    }
  }, [transcription.id, transcription.isTutorial, tutorialWelcomeModal]);

  return (
    <AudioProvider>
      <div>
        <TranscriptEditor
          hasWriteAccess={hasWriteAccess}
          hasListenAccess={hasListenAccess}
          transcription={transcription}
          onSaveStatusChange={onSaveStatusChange}
        />
        <TutorialWelcomeDialog />
      </div>
    </AudioProvider>
  );
}
