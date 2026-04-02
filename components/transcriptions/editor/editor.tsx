"use client";

import { cn } from "@/lib/utils";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TranscriptionDetail } from "../../../hooks/use-transcriptions";
import { AudioControls, InteractiveAudio } from "./audio";
import { EditorAPI } from "./text/api";
import { SpeakerColumn } from "./text/components/speaker-column";
import { SpeakerRenameDialog } from "./text/components/speaker-rename-dialog";
import { TranscriptEditorContentTipTap } from "./text/tiptap";
import { useNavigationMode } from "./text/hooks/use-navigation-mode";
import { ActiveSegmentHighlight } from "./text/components/active-segment-highlight";
import { useAudioSync } from "./text/hooks/use-audio-sync";

export function TranscriptEditor({
  hasWriteAccess,
  hasListenAccess,
  transcription,
}: {
  hasWriteAccess: boolean;
  hasListenAccess: boolean;
  transcription: TranscriptionDetail;
}) {
  const editorAPIRef = useRef(new EditorAPI());
  const editorAPI = editorAPIRef.current;
  const [audioControls, setAudioControls] = useState<AudioControls | null>(
    null,
  );
  const { selectionUpdate } = useAudioSync(editorAPI);
  const { state, currentIndex } = useNavigationMode(editorAPI, audioControls);

  return (
    <div className="h-full">
      <SpeakerRenameDialog />
      <div className="flex flex-col h-full">
        {false && (
          <>
            <div className="mb-2 px-4 py-2 bg-yellow-100 dark:bg-yellow-900/30 border-y border-yellow-300 dark:border-yellow-700 text-sm text-yellow-800 dark:text-yellow-200 fixed w-full z-10">
              <span className="font-semibold">{"Someone"}</span> is currently
              editing this transcription
            </div>
            <div className="h-8" />{" "}
            {/* Spacer to prevent content jump due to fixed banner */}
          </>
        )}

        {/* Sticky top section */}
        {createPortal(
          <div id="header-sub-portal-container" className={cn("space-y-2")}>
            {hasListenAccess ? (
              <InteractiveAudio
                editorAPI={editorAPI}
                id={transcription.id}
                audioFileEncryption={transcription.audioFileEncryption}
                onAudioControlsReady={setAudioControls}
              />
            ) : (
              <div className="pt-2"></div>
            )}
            <div className="px-4 pb-2">TODO</div>
          </div>,
          document.getElementById("header-sub-portal")!,
        )}

        {/* Scrollable content area */}
        <div className="flex flex-row px-4 gap-2 flex-1 pb-6 pt-4 pb-16">
          <SpeakerColumn
            editorAPI={editorAPI}
            onRenameSpeaker={() => {}}
            readOnly={!hasWriteAccess}
          />
          <div className="flex-1 px-2">
            <div className="relative">
              {false && "TODO Cursors and highlights"}
              <ActiveSegmentHighlight
                editorAPI={editorAPI}
                segmentIndex={currentIndex}
                visible={state === "navigate" && currentIndex >= 0}
              />
              <div>
                <TranscriptEditorContentTipTap
                  speakers={transcription.transcription?.speakers || []}
                  segments={transcription.transcription?.words || []}
                  editorAPI={editorAPI}
                  onChange={(segments) => {
                    editorAPI.emit("change");
                  }}
                  onSelectionUpdate={(selection) => {
                    selectionUpdate();
                  }}
                  onUpdate={() => {}}
                  hasWriteAccess={hasWriteAccess}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
