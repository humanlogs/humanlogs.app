"use client";

import { useEffect, useSyncExternalStore } from "react";
import { CodingStart } from "@/components/codebooks/coding-start";
import { writeCodingCodebook } from "@/lib/codebooks/coding-codebook";
import {
  codingSessionServerSnapshot,
  isCodingSessionActive,
  startCodingSession,
  subscribeCodingSession,
} from "@/lib/documents/coding-session";
import { TranscriptionDetail } from "../../hooks/use-transcriptions";
import {
  TutorialWelcomeDialog,
  useTutorialWelcomeModal,
} from "../dialogs/tutorial-welcome-dialog";
import { AudioProvider } from "./editor/audio/audio-context";
import { TranscriptEditor } from "./editor/editor";
import type { DocumentPhase } from "./editor/phase";
import { EditorAPI } from "./editor/text/api";
import { SaveStatus } from "./editor/text/hooks/use-auto-save";

type TranscriptionEditorProps = {
  hasWriteAccess: boolean;
  hasListenAccess: boolean;
  transcription: TranscriptionDetail;
  phase?: DocumentPhase;
  onEditorReady?: (editorAPI: EditorAPI) => void;
  onSaveStatusChange?: (status: SaveStatus) => void;
};

export function TranscriptionEditor({
  hasWriteAccess,
  hasListenAccess,
  transcription,
  phase,
  onEditorReady,
  onSaveStatusChange,
}: TranscriptionEditorProps) {
  const tutorialWelcomeModal = useTutorialWelcomeModal();

  /**
   * A coding pass is under way, so this document goes straight into the editor.
   *
   * Otherwise the grille has not been chosen and the start screen asks — once per
   * pass, not once per document (`lib/documents/coding-session.ts`). Per STUDY,
   * because that is what a pass is over: the grilles on offer, the one chosen and
   * whether there is one at all are all per study.
   *
   * The gate is HERE, above the editor, rather than inside it. Inside, the editor
   * was still constructed behind the screen and its effects measured a document
   * that had never been mounted — which TipTap answers by throwing from
   * `editor.view`. Not building it also spares a Yjs connection nobody is using.
   */
  const study = transcription.projectId;
  const codingStarted = useSyncExternalStore(
    subscribeCodingSession,
    () => isCodingSessionActive(study),
    codingSessionServerSnapshot,
  );

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

  if (phase === "coding" && !codingStarted) {
    return (
      <CodingStart
        transcriptionId={transcription.id}
        projectId={transcription.projectId}
        textLength={transcription.textLength}
        onChoose={(codebookId) => {
          writeCodingCodebook(transcription.projectId, codebookId);
          startCodingSession(transcription.projectId);
        }}
      />
    );
  }

  return (
    <AudioProvider>
      <div className="w-full min-w-0">
        <TranscriptEditor
          hasWriteAccess={hasWriteAccess}
          hasListenAccess={hasListenAccess}
          transcription={transcription}
          phase={phase}
          onEditorReady={onEditorReady}
          onSaveStatusChange={onSaveStatusChange}
        />
        <TutorialWelcomeDialog />
      </div>
    </AudioProvider>
  );
}
