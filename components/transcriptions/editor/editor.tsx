"use client";

import { useTranscriptionCursors } from "@/hooks/use-transcription-cursors";
import { cn } from "@/lib/utils/utils";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TranscriptionDetail } from "../../../hooks/use-transcriptions";
import { InteractiveAudio } from "./audio";
import { EditorAPI } from "./text/api";
import { ActiveSegmentHighlight } from "./text/components/active-segment-highlight";
import { EditorToolbar } from "./text/components/editor-toolbar";
import { RemoteCursors } from "./text/components/remote-cursors";
import { SearchHighlights } from "./text/components/search-highlights";
import { SpeakerColumn } from "./text/components/speaker-column";
import { SpeakerRenameDialog } from "./text/components/speaker-rename-dialog";
import { useAudioSync } from "./text/hooks/use-audio-sync";
import { SaveStatus, useAutoSave } from "./text/hooks/use-auto-save";
import { useCollaborationLock } from "./text/hooks/use-collaboration-lock";
import { useFormat } from "./text/hooks/use-format";
import { useNavigationMode } from "./text/hooks/use-navigation-mode";
import { useSearchReplace } from "./text/hooks/use-search-replace";
import { TranscriptEditorContentTipTap } from "./text/tiptap";
import { segmentsToHtml } from "./text/utils/html";
import { AudioControls } from "./audio/helpers";

function SegmentsHtmlDebugPanel({ editorAPI }: { editorAPI: EditorAPI }) {
  const [html, setHtml] = useState("");

  useEffect(() => {
    const update = () => {
      const segments = editorAPI.getSegments();
      setHtml(segments.length ? segmentsToHtml(segments) : "");
    };

    update();

    editorAPI.on("segmentsChange", update);
    editorAPI.on("change", update);

    return () => {
      editorAPI.off("segmentsChange", update);
      editorAPI.off("change", update);
    };
  }, [editorAPI]);

  return (
    <div className="hidden xl:flex xl:basis-[40%] xl:min-w-[320px] xl:max-w-[640px] shrink min-w-0 flex-col overflow-hidden">
      <div className="h-full w-full overflow-auto rounded-md border bg-background p-3">
        <div
          className="ProseMirror text-base leading-relaxed focus:outline-none relative"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}

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
  const containerRef = useRef<HTMLDivElement | null>(null);
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
  const [showSegmentsHtmlDebug, setShowSegmentsHtmlDebug] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setShowSegmentsHtmlDebug(window.location.search.includes("dev"));
  }, []);

  useEffect(() => {
    if (!showSegmentsHtmlDebug || !containerRef.current) return;

    const root = containerRef.current;

    const elementPath = (el: HTMLElement) => {
      const parts: string[] = [];
      let cur: HTMLElement | null = el;
      for (let i = 0; i < 4 && cur; i++) {
        const cls = (cur.className || "")
          .toString()
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .join(".");
        parts.push(`${cur.tagName.toLowerCase()}${cls ? `.${cls}` : ""}`);
        cur = cur.parentElement;
      }
      return parts.join(" <- ");
    };

    const scanOverflow = () => {
      const all = [
        root,
        ...Array.from(root.querySelectorAll("*")),
      ] as HTMLElement[];
      const offenders = all
        .map((el) => {
          const delta = el.scrollWidth - el.clientWidth;
          return {
            el,
            delta,
            clientWidth: el.clientWidth,
            scrollWidth: el.scrollWidth,
            style: getComputedStyle(el).display,
          };
        })
        .filter((x) => x.delta > 1)
        .sort((a, b) => b.delta - a.delta)
        .slice(0, 8)
        .map((x) => ({
          overflowBy: x.delta,
          clientWidth: x.clientWidth,
          scrollWidth: x.scrollWidth,
          display: x.style,
          path: elementPath(x.el),
        }));

      if (offenders.length) {
        console.groupCollapsed("[Editor Overflow Debug] Top overflow culprits");
        console.table(offenders);
        console.groupEnd();
      }
    };

    scanOverflow();
    const ro = new ResizeObserver(scanOverflow);
    ro.observe(root);
    window.addEventListener("resize", scanOverflow);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", scanOverflow);
    };
  }, [showSegmentsHtmlDebug]);

  // Collaboration lock
  const { isLocked, lockedBy, isLockedByMe } = useCollaborationLock(
    transcription.id,
  );

  // In real-time collab (`?collab`) the single-writer lock is bypassed: every user
  // with write access edits concurrently (CRDT). Otherwise the legacy lock stands.
  const [collabEnabled, setCollabEnabled] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setCollabEnabled(new URLSearchParams(window.location.search).has("collab"));
  }, []);
  const canWrite = collabEnabled
    ? hasWriteAccess
    : isLockedByMe && hasWriteAccess;

  // Auto-save with debounce. In collab the Y.Doc is the live source of truth and
  // Postgres is just a checkpoint, so we save less aggressively (and only the save
  // leader persists — gated in the editor hook).
  const { onChange: autoSaveOnChange, saveStatus, flush: flushSave } =
    useAutoSave({
      transcriptionId: transcription.id,
      editorAPI,
      debounceMs: collabEnabled ? 5000 : 3000,
    });

  // Collab: when this client becomes the save leader (authority handoff), persist
  // the current state immediately so no edits sit in an unsaved window.
  useEffect(() => {
    if (!collabEnabled) return;
    const onBecameSaver = () => flushSave();
    editorAPI.addListener("becameSaver", onBecameSaver);
    return () => {
      editorAPI.removeListener("becameSaver", onBecameSaver);
    };
  }, [collabEnabled, editorAPI, flushSave]);

  // Notify parent when editor is ready
  useEffect(() => {
    onEditorReady?.(editorAPI);
  }, [editorAPI, onEditorReady]);

  // Notify parent when save status changes
  useEffect(() => {
    onSaveStatusChange?.(saveStatus);
  }, [saveStatus, onSaveStatusChange]);

  return (
    <div ref={containerRef} className="h-full min-w-0 overflow-x-hidden">
      <SpeakerRenameDialog />
      <div className="flex flex-col h-full">
        {!collabEnabled && isLocked && !isLockedByMe && (
          <>
            <div className="mb-2 px-4 py-2 bg-yellow-100 dark:bg-yellow-900/30 border-y border-yellow-300 dark:border-yellow-700 text-sm text-yellow-800 dark:text-yellow-200 fixed w-full z-10">
              <span className="font-semibold">
                {lockedBy?.userName || "Someone"}
              </span>{" "}
              is currently editing this transcription
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
                hasWriteAccess={canWrite}
                hasListenAccess={hasListenAccess}
              />
            </div>
          </div>,
          document.getElementById("header-sub-portal")!,
        )}

        {/* Scrollable content area */}
        <div className="flex flex-row px-4 gap-2 flex-1 min-w-0 overflow-hidden pb-6 pt-4 pb-16">
          <SpeakerColumn editorAPI={editorAPI} readOnly={!canWrite} />
          <div className="flex-[1_1_0%] px-2 min-w-0 flex gap-4 overflow-hidden">
            <div className="relative flex-[1_1_0%] min-w-0 overflow-visible">
              {/* Text carets come from CollaborationCursor in collab mode; the
                  custom socket cursors still drive the audio waveform ticks. */}
              {!collabEnabled && (
                <RemoteCursors editorAPI={editorAPI} cursors={cursors} />
              )}
              <SearchHighlights highlights={searchReplace.highlights} />
              <ActiveSegmentHighlight
                editorAPI={editorAPI}
                segmentIndex={currentIndex}
                visible={state === "navigate" && currentIndex >= 0}
              />
              <div className="w-full min-w-0 max-w-full overflow-hidden">
                <TranscriptEditorContentTipTap
                  transcriptionId={transcription.id}
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
                      canWrite,
                    );
                    selectionUpdate();
                    formatSelectionUpdate(editor);
                  }}
                  onUpdate={() => {}}
                  hasWriteAccess={canWrite}
                />
              </div>
            </div>
            {showSegmentsHtmlDebug && (
              <SegmentsHtmlDebugPanel editorAPI={editorAPI} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
