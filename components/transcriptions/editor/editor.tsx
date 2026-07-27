"use client";

import {
  useMarkNotificationsRead,
  useNotificationCounts,
} from "@/hooks/use-notifications";
import { useTranscriptionCursors } from "@/hooks/use-transcription-cursors";
import { cn } from "@/lib/utils/utils";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import {
  TranscriptionDetail,
  useTranscriptionAesKey,
} from "../../../hooks/use-transcriptions";
import { InteractiveAudio } from "./audio";
import { EditorAPI } from "./text/api";
import { ActiveSegmentHighlight } from "./text/components/active-segment-highlight";
import { CommentRail } from "./text/components/comment-rail";
import { EditorToolbar } from "./text/components/editor-toolbar";
import { SearchHighlights } from "./text/components/search-highlights";
import { SpeakerColumn } from "./text/components/speaker-column";
import { SpeakerRenameDialog } from "./text/components/speaker-rename-dialog";
import { useAudioSync } from "./text/hooks/use-audio-sync";
import { useCommentThreads } from "./text/hooks/use-comment-threads";
import { SaveStatus, useAutoSave } from "./text/hooks/use-auto-save";
import { useFormat } from "./text/hooks/use-format";
import { useNavigationMode } from "./text/hooks/use-navigation-mode";
import { useSearchReplace } from "./text/hooks/use-search-replace";
import { TranscriptEditorContentTipTap } from "./text/tiptap";
import { segmentsToHtml } from "./text/utils/html";
import { AudioControls } from "./audio/helpers";

/** Roughly where the sticky header ends, used to probe the first visible line. */
const HEADER_SAFE_TOP = 140;

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

/** The `?dev` flag never changes without a reload, so there is nothing to subscribe to. */
const subscribeToNothing = () => () => {};

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
  // Lazy initialiser: constructed once, stable identity, and never re-created
  // on re-render (which `useRef(new EditorAPI())` would do, then discard).
  const [editorAPI] = useState(() => new EditorAPI());
  const { cursors, updateCursorPosition, updateAudioPosition } =
    useTranscriptionCursors(transcription.id);
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
  // Client-only URL flag, read without a state-setting effect (server snapshot
  // is `false`, so hydration matches).
  const showSegmentsHtmlDebug = useSyncExternalStore(
    subscribeToNothing,
    () => window.location.search.includes("dev"),
    () => false,
  );

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

  // Real-time collaborative editing (CRDT): every user with write access edits
  // concurrently — no single-writer lock.
  const canWrite = hasWriteAccess;

  // Comment threads: creating/focusing threads, and dropping abandoned anchors.
  const commentThreads = useCommentThreads({ editorAPI, canWrite });

  // Notifications about this document are about its comments, so they are cleared when
  // the rail is actually opened — not merely by landing on the page, which would wipe
  // the sidebar badge before the user has seen what it was pointing at. Guarded on the
  // count so opening the rail again sends nothing.
  const { data: notificationCounts } = useNotificationCounts();
  const { mutate: markNotificationsRead } = useMarkNotificationsRead();
  const unreadHere =
    notificationCounts?.byEntity[`transcription:${transcription.id}`] ?? 0;
  useEffect(() => {
    if (!commentThreads.railOpen || unreadHere === 0) return;
    markNotificationsRead({
      entityType: "transcription",
      entityId: transcription.id,
    });
  }, [
    commentThreads.railOpen,
    unreadHere,
    transcription.id,
    markNotificationsRead,
  ]);


  // Thread whose highlight is emphasised in the transcript: the one hovered in the
  // rail, otherwise the focused one.
  const [hoveredAnchorId, setHoveredAnchorId] = useState<string | null>(null);
  const emphasisedAnchorId = hoveredAnchorId ?? commentThreads.activeAnchorId;

  /**
   * Keep the reader in place when the rail opens or closes.
   *
   * The rail takes real width, so showing it re-wraps the transcript into a narrower
   * column and every line below moves — measured at ~130px of drift mid-document, which
   * reads as the page jumping under you. So we note which line sits at the top of the
   * view beforehand and, once the new layout is in place but before it is painted,
   * scroll by however far that line moved.
   */
  const readingAnchorRef = useRef<{ pos: number; y: number } | null>(null);
  const captureReadingAnchor = () => {
    const view = editorAPI.getEditor()?.view;
    const el = editorAPI.getEditorElement();
    if (!view || !el) return;
    const rect = el.getBoundingClientRect();
    // Probe just inside the visible top of the transcript, clear of the sticky header.
    const top = Math.min(
      Math.max(rect.top, HEADER_SAFE_TOP) + 4,
      window.innerHeight - 4,
    );
    const hit = view.posAtCoords({ left: rect.left + 24, top });
    if (!hit) return;
    try {
      readingAnchorRef.current = {
        pos: hit.pos,
        y: view.coordsAtPos(hit.pos).top,
      };
    } catch {
      readingAnchorRef.current = null;
    }
  };

  useLayoutEffect(() => {
    const anchor = readingAnchorRef.current;
    readingAnchorRef.current = null;
    if (!anchor) return;
    const view = editorAPI.getEditor()?.view;
    if (!view) return;
    try {
      const delta = view.coordsAtPos(anchor.pos).top - anchor.y;
      if (Math.abs(delta) > 1) window.scrollBy(0, delta);
    } catch {
      // The anchored position no longer exists — nothing sensible to restore.
    }
  }, [commentThreads.railOpen, editorAPI]);

  // Focus a thread when its highlighted text is clicked in the editor.
  useEffect(() => {
    let bound: HTMLElement | null = null;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const span = target?.closest?.("span[data-comment-id]");
      const anchorId = span?.getAttribute("data-comment-id");
      if (anchorId) commentThreads.openThread(anchorId);
    };
    const bind = () => {
      const el = editorAPI.getEditorElement();
      if (!el || el === bound) return;
      bound?.removeEventListener("click", onClick);
      el.addEventListener("click", onClick);
      bound = el;
    };
    bind();
    editorAPI.addListener("ready", bind);
    return () => {
      editorAPI.removeListener("ready", bind);
      bound?.removeEventListener("click", onClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorAPI, commentThreads.openThread]);

  // Stable session AES key (E2E). The collab provider must not start until this is
  // resolved for an encrypted transcription, so content is never relayed in clear.
  const { aesKey, isEncrypted } = useTranscriptionAesKey(transcription.id);

  // Auto-save with debounce. The Y.Doc is the live source of truth and Postgres is
  // just a checkpoint, so we save less aggressively (and only the save leader
  // persists — gated in the editor hook).
  const { onChange: autoSaveOnChange, saveStatus, flush: flushSave } =
    useAutoSave({
      transcriptionId: transcription.id,
      editorAPI,
      debounceMs: 5000,
      // Saves reuse the stable session key (no rotation) so late joiners keep
      // decrypting the shared content.
      sessionAesKey: aesKey,
    });

  /**
   * A note is stored the moment it is sent, but its anchor lives in the transcript,
   * which only autosaves after a debounce — closing the tab in between would leave the
   * note with nothing to attach to. So persist the transcript as soon as an anchor
   * appears or disappears, after letting the (debounced) segment projection catch up
   * with the mark that was just added or removed.
   */
  const flushAnchors = () => {
    setTimeout(() => flushSave(), 500);
  };

  // When this client becomes the save leader (authority handoff), persist the
  // current state immediately so no edits sit in an unsaved window.
  useEffect(() => {
    const onBecameSaver = () => flushSave();
    editorAPI.addListener("becameSaver", onBecameSaver);
    return () => {
      editorAPI.removeListener("becameSaver", onBecameSaver);
    };
  }, [editorAPI, flushSave]);

  // A version revert requires a full reload (the editor hook already left the collab
  // room). Show a blocking prompt so no stale edit is made before reloading.
  const [revertedBy, setRevertedBy] = useState<string | null>(null);
  useEffect(() => {
    const onReverted = (data: { byName: string }) =>
      setRevertedBy(data?.byName || "A collaborator");
    editorAPI.addListener("reverted", onReverted);
    return () => {
      editorAPI.removeListener("reverted", onReverted);
    };
  }, [editorAPI]);

  // Broadcast our audio playback/scrub position so peers' waveform ticks follow us
  // while listening (not only when the edit caret moves).
  useEffect(() => {
    if (!audioControls) return;
    return audioControls.onTimeUpdate((time) => updateAudioPosition(time));
  }, [audioControls, updateAudioPosition]);

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
      {revertedBy && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 max-w-sm rounded-lg border bg-background p-6 text-center shadow-lg">
            <p className="text-base font-semibold">Version restored</p>
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="font-medium">{revertedBy}</span> restored an
              earlier version of this transcription. Reload to continue with the
              restored content.
            </p>
            <button
              className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </div>
      )}
      <SpeakerRenameDialog />

      {/* Emphasising the hovered/focused thread as a CSS rule rather than a class on the
          spans: those are ProseMirror-managed, so any class set imperatively is dropped
          the next time it redraws them. A rule keyed on the id always matches, however
          often the spans are recreated. */}
      {emphasisedAnchorId && /^[\w-]+$/.test(emphasisedAnchorId) && (
        <style>{`
          span[data-comment-id="${emphasisedAnchorId}"] {
            background-color: color-mix(in oklab, var(--color-yellow-400) 70%, transparent);
          }
          .dark span[data-comment-id="${emphasisedAnchorId}"] {
            background-color: color-mix(in oklab, var(--color-yellow-500) 50%, transparent);
          }
        `}</style>
      )}

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
                hasWriteAccess={canWrite}
                hasListenAccess={hasListenAccess}
                onComment={commentThreads.startNewComment}
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
              {/* Text carets come from CollabCaret (awareness); the custom socket
                  cursors drive only the audio waveform ticks. */}
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
                  isEncrypted={isEncrypted}
                  aesKey={aesKey}
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
                  hasWriteAccess={canWrite}
                />
              </div>
            </div>
            <CommentRail
              transcriptionId={transcription.id}
              editorAPI={editorAPI}
              canWrite={canWrite}
              open={commentThreads.railOpen}
              activeAnchorId={commentThreads.activeAnchorId}
              onOpenThread={(anchorId) => {
                captureReadingAnchor();
                commentThreads.openThread(anchorId);
              }}
              onHoverThread={setHoveredAnchorId}
              onCloseRail={() => {
                captureReadingAnchor();
                commentThreads.closeRail();
              }}
              onSaved={() => {
                commentThreads.markSaved();
                flushAnchors();
              }}
              onEmptied={(anchorId) => {
                commentThreads.emptied(anchorId);
                flushAnchors();
              }}
            />
            {showSegmentsHtmlDebug && (
              <SegmentsHtmlDebugPanel editorAPI={editorAPI} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
