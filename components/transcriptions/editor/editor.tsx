"use client";

import { useTranscriptionCursors } from "@/hooks/use-transcription-cursors";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TranscriptionDetail } from "../../../hooks/use-transcriptions";
import { AudioControls, InteractiveAudio } from "./audio";
import { EditorAPI } from "./text/api";
import { ActiveSegmentHighlight } from "./text/components/active-segment-highlight";
import { EditorToolbar } from "./text/components/editor-toolbar";
import { RemoteCursors } from "./text/components/remote-cursors";
import { SearchHighlights } from "./text/components/search-highlights";
import { SpeakerColumn } from "./text/components/speaker-column";
import { SpeakerRenameDialog } from "./text/components/speaker-rename-dialog";
import { useAudioSync } from "./text/hooks/use-audio-sync";
import { SaveStatus, useAutoSave } from "./text/hooks/use-auto-save";
import { useFormat } from "./text/hooks/use-format";
import { useNavigationMode } from "./text/hooks/use-navigation-mode";
import { useSearchReplace } from "./text/hooks/use-search-replace";
import { TranscriptEditorContentTipTap } from "./text/tiptap";

export function TranscriptEditor({
  hasWriteAccess,
  hasListenAccess,
  transcription,
  onEditorReady,
  onSaveStatusChange,
}: {
  hasWriteAccess: boolean;
  hasListenAccess: boolean;
  transcription: TranscriptionDetail;
  onEditorReady?: (editorAPI: EditorAPI) => void;
  onSaveStatusChange?: (status: SaveStatus) => void;
}) {
  const editorAPIRef = useRef(new EditorAPI());
  const editorAPI = editorAPIRef.current;
  const { cursors, updateCursorPosition } = useTranscriptionCursors(
    transcription.id,
  );
  const [audioControls, setAudioControls] = useState<AudioControls | null>(
    null,
  );
  const { selectionUpdate } = useAudioSync(editorAPI);
  const { state, currentIndex } = useNavigationMode(editorAPI, audioControls);
  const {
    applyFormat,
    activeFormats,
    selectionUpdate: formatSelectionUpdate,
  } = useFormat(editorAPI, currentIndex);
  const searchReplace = useSearchReplace(editorAPI);

  // Auto-save with debounce
  const { onChange: autoSaveOnChange, saveStatus } = useAutoSave({
    transcriptionId: transcription.id,
    editorAPI,
  });

  // Notify parent when editor is ready
  useEffect(() => {
    onEditorReady?.(editorAPI);
  }, [editorAPI, onEditorReady]);

  // Notify parent when save status changes
  useEffect(() => {
    onSaveStatusChange?.(saveStatus);
  }, [saveStatus, onSaveStatusChange]);

  // useBracketWrap();

  return (
    <div className="h-full">
      <SpeakerRenameDialog />
      <div className="flex flex-col h-full">
        {/* Sticky top section */}
        {createPortal(
          <div id="header-sub-portal-container" className={cn("space-y-2")}>
            {hasListenAccess ? (
              <InteractiveAudio
                editorAPI={editorAPI}
                id={transcription.id}
                audioFileEncryption={transcription.audioFileEncryption}
                onAudioControlsReady={setAudioControls}
                cursors={cursors}
              />
            ) : (
              <div className="pt-2"></div>
            )}
            <div className="px-4 pb-2">
              <EditorToolbar
                applyFormat={applyFormat}
                activeFormats={activeFormats}
                searchReplace={searchReplace}
                audioControls={audioControls}
                hasWriteAccess={hasWriteAccess}
                hasListenAccess={hasListenAccess}
              />
            </div>
          </div>,
          document.getElementById("header-sub-portal")!,
        )}

        {/* Scrollable content area */}
        <div className="flex flex-row px-4 gap-2 flex-1 pb-6 pt-4 pb-16">
          <SpeakerColumn editorAPI={editorAPI} readOnly={!hasWriteAccess} />
          <div className="flex-1 px-2">
            <div className="relative">
              <RemoteCursors editorAPI={editorAPI} cursors={cursors} />
              <SearchHighlights highlights={searchReplace.highlights} />
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
                  onChange={() => {
                    editorAPI.emit("change");
                    autoSaveOnChange();
                  }}
                  onSelectionUpdate={(editor) => {
                    updateCursorPosition(
                      editor.state.selection.from - 1,
                      editor.state.selection.to - 1,
                      hasWriteAccess,
                    );
                    selectionUpdate();
                    formatSelectionUpdate(editor);
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
