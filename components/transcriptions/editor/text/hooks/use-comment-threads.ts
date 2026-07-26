"use client";

import { useCallback, useRef, useState } from "react";
import { EditorAPI } from "../api";
import {
  applyCommentMark,
  removeCommentMark,
} from "../utils/comment-actions";

/**
 * Controller for the comment thread popover. Owns which thread is open, creates the
 * anchor mark for a brand-new comment, and cleans up the anchor when a new thread is
 * abandoned before its first note is saved or when a thread's last note is deleted.
 */
export function useCommentThreads({
  editorAPI,
  canWrite,
}: {
  editorAPI: EditorAPI;
  canWrite: boolean;
}) {
  const [activeAnchorId, setActiveAnchorId] = useState<string | null>(null);
  // The anchor of a just-created thread whose first note hasn't been saved yet. If the
  // popover closes while this still matches the active thread, the dangling mark is
  // removed so we never leave an orphan highlight.
  const pendingNewRef = useRef<string | null>(null);

  const getEditor = () => editorAPI.getEditor();

  /** Drop the mark of a still-unsaved thread we're navigating away from. */
  const discardPending = useCallback((except?: string) => {
    const pending = pendingNewRef.current;
    if (!pending || pending === except) return;
    const editor = getEditor();
    if (editor) {
      removeCommentMark(editor, pending);
      editorAPI.emit("commentsChange");
    }
    pendingNewRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startNewComment = useCallback(() => {
    const editor = getEditor();
    if (!editor || !canWrite) return;
    discardPending();
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `comment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    if (!applyCommentMark(editor, id)) return; // nothing to anchor (empty line)
    editorAPI.emit("commentsChange");
    pendingNewRef.current = id;
    setActiveAnchorId(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canWrite, discardPending]);

  const openThread = useCallback(
    (anchorId: string) => {
      discardPending(anchorId);
      setActiveAnchorId(anchorId);
    },
    [discardPending],
  );

  // A note was saved into the active thread → it's no longer a throwaway.
  const markSaved = useCallback(() => {
    pendingNewRef.current = null;
  }, []);

  const close = useCallback(() => {
    discardPending();
    setActiveAnchorId(null);
  }, [discardPending]);

  // The last note in a thread was deleted → drop the anchor mark and close.
  const emptied = useCallback((anchorId: string) => {
    const editor = getEditor();
    if (editor) {
      removeCommentMark(editor, anchorId);
      editorAPI.emit("commentsChange");
    }
    pendingNewRef.current = null;
    setActiveAnchorId((cur) => (cur === anchorId ? null : cur));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getAnchorRect = useCallback(
    () => (activeAnchorId ? editorAPI.getCommentAnchorRect(activeAnchorId) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeAnchorId],
  );

  return {
    activeAnchorId,
    startNewComment,
    openThread,
    close,
    markSaved,
    emptied,
    getAnchorRect,
  };
}
