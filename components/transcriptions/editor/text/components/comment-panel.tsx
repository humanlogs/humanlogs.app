"use client";

import { useTranslations } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useUserProfile } from "@/hooks/use-api";
import {
  DecryptedComment,
  useAddComment,
  useComments,
  useDeleteComment,
  useEditComment,
} from "@/hooks/use-comments";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EditorAPI } from "../api";
import {
  excerptText,
  getCommentRanges,
  getTouchingAnchorIds,
  selectCommentRange,
} from "../utils/comment-actions";

const PANEL_WIDTH = 320;

interface CommentPanelProps {
  transcriptionId: string;
  editorAPI: EditorAPI;
  /** Active thread anchor id, or null when the panel is closed. */
  anchorId: string | null;
  /** Live viewport rect of the active thread's anchored text. */
  getAnchorRect: () => DOMRect | null;
  canWrite: boolean;
  onClose: () => void;
  /** Called after a note is saved (the thread is no longer a throwaway). */
  onSaved: () => void;
  /** Called after a thread's last note is deleted (anchor should be dropped). */
  onEmptied: (anchorId: string) => void;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function authorLabel(
  c: DecryptedComment,
  currentUserId: string | undefined,
  youLabel: string,
): string {
  if (c.userId === currentUserId) return youLabel;
  return c.author?.name || c.author?.email || "";
}

/**
 * Floating comment panel.
 *
 * Deliberately NOT a base-ui Popover: that primitive dismisses on any outside click,
 * which fights this panel's core interactions — it is opened *by* a click (the toolbar
 * button or a highlight), and clicking a thread selects text back in the editor. So
 * positioning and dismissal (Escape, or a press that is neither in the panel, nor on a
 * highlight, nor on a gutter dot) are handled here, and focus is never trapped so the
 * editor keeps its selection.
 */
export function CommentPanel({
  transcriptionId,
  editorAPI,
  anchorId,
  getAnchorRect,
  canWrite,
  onClose,
  onSaved,
  onEmptied,
}: CommentPanelProps) {
  const open = anchorId !== null;
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(
    null,
  );

  // Keep the panel pinned next to its anchor across scrolling, resizing and edits.
  useEffect(() => {
    if (!open) return;

    let raf: number | null = null;
    let attempts = 0;
    const place = () => {
      if (raf !== null) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        const rect = getAnchorRect();
        if (!rect) {
          // A freshly applied mark may not be in the DOM yet — retry a few frames.
          if (attempts++ < 20) place();
          return;
        }
        attempts = 0;
        const left = Math.min(
          rect.right + 16,
          window.innerWidth - PANEL_WIDTH - 12,
        );
        const height = panelRef.current?.offsetHeight ?? 240;
        const top = Math.max(
          12,
          Math.min(rect.top, window.innerHeight - height - 12),
        );
        setPosition({ top, left: Math.max(12, left) });
      });
    };

    place();
    window.addEventListener("scroll", place, { passive: true, capture: true });
    window.addEventListener("resize", place, { passive: true });
    editorAPI.addListener("change", place);
    editorAPI.addListener("commentsChange", place);
    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", place, { capture: true });
      window.removeEventListener("resize", place);
      editorAPI.removeListener("change", place);
      editorAPI.removeListener("commentsChange", place);
    };
  }, [open, anchorId, getAnchorRect, editorAPI]);

  // Dismiss on Escape, or on a press outside the panel that isn't on a highlight or a
  // gutter dot (those switch threads instead). Pointerdown, so the very click that
  // opened the panel — already dispatched — can never close it.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (target.closest?.("span[data-comment-id], [data-comment-gutter]")) {
        return;
      }
      onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open || !anchorId) return null;

  return (
    <div
      ref={panelRef}
      className="fixed z-50 flex max-h-[70vh] flex-col overflow-hidden rounded-lg border border-foreground/10 bg-popover text-popover-foreground shadow-lg"
      style={{
        width: PANEL_WIDTH,
        top: position?.top ?? -9999,
        left: position?.left ?? -9999,
        visibility: position ? "visible" : "hidden",
      }}
    >
      <CommentPanelContent
        key={anchorId}
        transcriptionId={transcriptionId}
        editorAPI={editorAPI}
        anchorId={anchorId}
        canWrite={canWrite}
        onClose={onClose}
        onSaved={onSaved}
        onEmptied={onEmptied}
      />
    </div>
  );
}

/** Panel body, remounted per thread so the draft resets cleanly. */
function CommentPanelContent({
  transcriptionId,
  editorAPI,
  anchorId,
  canWrite,
  onClose,
  onSaved,
  onEmptied,
}: {
  transcriptionId: string;
  editorAPI: EditorAPI;
  anchorId: string;
  canWrite: boolean;
  onClose: () => void;
  onSaved: () => void;
  onEmptied: (anchorId: string) => void;
}) {
  const t = useTranslations("editor");
  const { data: profile } = useUserProfile();
  const { data: allComments } = useComments(transcriptionId);
  const addComment = useAddComment(transcriptionId);
  const editComment = useEditComment(transcriptionId);
  const deleteComment = useDeleteComment(transcriptionId);

  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Which threads to show (the active one plus every thread whose range touches it) and
  // their quoted text, read from the document. Held in state and refreshed on editor
  // events rather than derived during render, so it can never be memoized stale.
  const readDoc = () => {
    const ed = editorAPI.getEditor();
    if (!ed) return { anchorIds: [anchorId], quotes: new Map<string, string>() };
    return {
      anchorIds: [anchorId, ...getTouchingAnchorIds(ed, anchorId)],
      quotes: new Map(getCommentRanges(ed).map((r) => [r.anchorId, r.text])),
    };
  };
  const [doc, setDoc] = useState(readDoc);

  useEffect(() => {
    const onDocChange = () => setDoc(readDoc());
    editorAPI.addListener("change", onDocChange);
    editorAPI.addListener("commentsChange", onDocChange);
    return () => {
      editorAPI.removeListener("change", onDocChange);
      editorAPI.removeListener("commentsChange", onDocChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorAPI, anchorId]);

  const { anchorIds, quotes } = doc;

  const notesByAnchor = new Map<string, DecryptedComment[]>();
  for (const id of anchorIds) {
    notesByAnchor.set(
      id,
      (allComments ?? [])
        .filter((c) => c.anchorId === id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    );
  }

  // Threads in chronological order (earliest note first); a brand-new thread with no
  // notes yet sorts last.
  const threads = anchorIds
    .map((id) => ({ id, notes: notesByAnchor.get(id) ?? [] }))
    .sort((a, b) => {
      const ta = a.notes[0]?.createdAt ?? "￿";
      const tb = b.notes[0]?.createdAt ?? "￿";
      return ta.localeCompare(tb);
    });

  // Focus the composer when a thread opens, without disturbing anything else.
  useEffect(() => {
    const id = setTimeout(() => textareaRef.current?.focus(), 30);
    return () => clearTimeout(id);
  }, []);

  const submitNew = async () => {
    const text = draft.trim();
    if (!text) return;
    await addComment.mutateAsync({ anchorId, text });
    setDraft("");
    onSaved();
    setTimeout(() => textareaRef.current?.focus(), 30);
  };

  const submitEdit = async (commentId: string) => {
    const text = editingText.trim();
    if (!text) return;
    await editComment.mutateAsync({ commentId, text });
    setEditingId(null);
  };

  const remove = async (c: DecryptedComment) => {
    const res = await deleteComment.mutateAsync({
      commentId: c.id,
      anchorId: c.anchorId,
    });
    if (res.threadEmpty) onEmptied(c.anchorId);
  };

  // Clicking a thread (its quote or any of its notes) selects the commented text.
  const selectThread = (id: string) => {
    const ed = editorAPI.getEditor();
    if (ed) selectCommentRange(ed, id);
  };

  return (
    <>
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
        <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
          {t("comments.title")}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("comments.cancel")}
          className="text-muted-foreground hover:text-foreground -mr-1 rounded p-1"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex flex-col divide-y divide-foreground/5 overflow-y-auto">
        {threads.map((thread) => {
          const isActive = thread.id === anchorId;
          const quote = quotes.get(thread.id);
          return (
            <div key={thread.id} className="px-3 py-2.5">
              {quote && (
                <button
                  type="button"
                  onClick={() => selectThread(thread.id)}
                  title={quote}
                  className={`mb-1.5 block w-full border-l-2 pl-2 text-left text-[11px] leading-snug italic ${
                    isActive
                      ? "border-orange-500 text-foreground/80"
                      : "border-orange-500/30 text-muted-foreground hover:text-foreground/80"
                  }`}
                >
                  {excerptText(quote)}
                </button>
              )}

              {thread.notes.length === 0 && (
                <p className="text-muted-foreground pl-2 text-xs">
                  {t("comments.empty")}
                </p>
              )}

              {thread.notes.map((c) => {
                const isMine = c.userId === profile?.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => selectThread(c.anchorId)}
                    className="cursor-pointer pl-2 py-1"
                  >
                    <div className="flex items-baseline gap-1.5">
                      <span className="truncate text-xs font-medium">
                        {authorLabel(c, profile?.id, t("comments.you"))}
                      </span>
                      <span className="text-muted-foreground shrink-0 text-[10px]">
                        {formatDate(c.createdAt)}
                      </span>
                    </div>

                    {editingId === c.id ? (
                      <div
                        className="mt-1 flex flex-col gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Textarea
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          className="min-h-[3rem] text-xs"
                        />
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground text-[10px]"
                            onClick={() => setEditingId(null)}
                          >
                            {t("comments.cancel")}
                          </button>
                          <button
                            type="button"
                            className="text-[10px] font-medium text-orange-600 disabled:opacity-50"
                            disabled={editComment.isPending}
                            onClick={() => submitEdit(c.id)}
                          >
                            {t("comments.save")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-foreground/90 mt-0.5 text-xs leading-snug whitespace-pre-wrap break-words">
                        {c.text}
                      </p>
                    )}

                    {isMine && editingId !== c.id && (
                      <div
                        className="mt-0.5 flex gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground text-[10px]"
                          onClick={() => {
                            setEditingId(c.id);
                            setEditingText(c.text);
                          }}
                        >
                          {t("comments.edit")}
                        </button>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-destructive text-[10px]"
                          onClick={() => remove(c)}
                        >
                          {t("comments.delete")}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {canWrite && (
        <div className="border-t border-foreground/10 p-2">
          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void submitNew();
              }
            }}
            placeholder={t("comments.placeholder")}
            className="min-h-[3rem] resize-none border-foreground/10 text-xs"
          />
          <div className="mt-1.5 flex justify-end">
            <Button
              size="sm"
              className="h-6 px-2.5 text-[11px]"
              disabled={!draft.trim() || addComment.isPending}
              onClick={() => void submitNew()}
            >
              {t("comments.add")}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
