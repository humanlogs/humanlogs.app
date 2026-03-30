"use client";

import { useEffect } from "react";
import { TranscriptionDetail } from "../../hooks/use-transcriptions";
import { AudioProvider } from "./editor/audio-context";
import { TranscriptEditor } from "./editor/editor";
import { SaveStatus } from "./editor/hooks/use-auto-save";
import {
  TutorialWelcomeDialog,
  useTutorialWelcomeModal,
} from "../dialogs/tutorial-welcome-dialog";

type TranscriptionEditorProps = {
  transcription: TranscriptionDetail;
  onSaveStatusChange?: (status: SaveStatus) => void;
};

export function TranscriptionEditor({
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
          transcription={transcription}
          onSaveStatusChange={onSaveStatusChange}
        />
        <TutorialWelcomeDialog />
      </div>
    </AudioProvider>
  );
}
