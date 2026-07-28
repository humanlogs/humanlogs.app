"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EditorAPI } from "../api";
import { applyCommentMark, removeCommentMark } from "../utils/comment-actions";

/**
 * Controller for the comment rail: which thread is focused, whether the rail is open,
 * creating the anchor mark for a new comment, and cleaning up the anchor when a new
 * thread is abandoned before its first note is saved or when its last note is deleted.
 */
export function useCommentThreads({
  editorAPI,
  canWrite,
}: {
  editorAPI: EditorAPI;
  canWrite: boolean;
}) {
  const [activeAnchorId, setActiveAnchorId] = useState<string | null>(null);
  const [railOpen, setRailOpen] = useState(false);
  // The anchor of a just-created thread whose first note hasn't been saved yet. If we
  // navigate away while this is still pending, the dangling mark is removed so we never
  // leave an orphan highlight.
  const pendingNewRef = useRef<string | null>(null);
  // Whether the rail was already open when the pending thread was started, so
  // abandoning it puts the view back exactly as it was rather than leaving an empty
  // column behind. Mirrored through a ref so `startNewComment` can read the current
  // value without taking `railOpen` as a dependency and losing its stable identity.
  const railOpenRef = useRef(false);
  const railWasOpenRef = useRef(false);
  useEffect(() => {
    railOpenRef.current = railOpen;
  }, [railOpen]);

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
    railWasOpenRef.current = railOpenRef.current;
    setRailOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canWrite, discardPending]);

  /**
   * Abandon a thread whose first note was never written — the user started a comment
   * and moved on without typing anything. The anchor mark goes with it, so the
   * transcript is not left highlighting a comment that does not exist.
   */
  const cancelPending = useCallback(() => {
    const pending = pendingNewRef.current;
    if (!pending) return;
    discardPending();
    setActiveAnchorId((cur) => (cur === pending ? null : cur));
    setRailOpen(railWasOpenRef.current);
  }, [discardPending]);

  /** Focus a thread — from a highlight, a gutter dot, or a card. Opens the rail. */
  const openThread = useCallback(
    (anchorId: string) => {
      discardPending(anchorId);
      setActiveAnchorId(anchorId);
      setRailOpen(true);
    },
    [discardPending],
  );

  /** A note was saved into the active thread → it's no longer a throwaway. */
  const markSaved = useCallback(() => {
    pendingNewRef.current = null;
  }, []);

  /** Collapse the rail back to the slim indicator column. */
  const closeRail = useCallback(() => {
    discardPending();
    setActiveAnchorId(null);
    setRailOpen(false);
  }, [discardPending]);

  const toggleRail = useCallback(() => {
    setRailOpen((wasOpen) => {
      if (wasOpen) {
        discardPending();
        setActiveAnchorId(null);
      }
      return !wasOpen;
    });
  }, [discardPending]);

  /** The last note in a thread was deleted → drop the anchor mark. */
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

  return {
    activeAnchorId,
    railOpen,
    startNewComment,
    cancelPending,
    openThread,
    closeRail,
    toggleRail,
    markSaved,
    emptied,
  };
}
