"use client";

import type { Editor } from "@tiptap/react";
import { useEffect } from "react";
import { wordRange } from "../utils/comment-actions";

/**
 * Keep the selection on whole words.
 *
 * Everything the coding phase does with a selection already rounds it out to words —
 * `applyCodingMark` and `applyCommentMark` both do, because a code applied to
 * "…faudr|ait" is a slip and never an intent. Doing it only at the moment of applying
 * meant the researcher aimed at one thing and got another, with the correction
 * happening invisibly. Snapping as the selection is made shows what will actually be
 * coded, while it is still being chosen.
 *
 * Idempotent: an already word-aligned range produces itself, so the transaction this
 * dispatches cannot feed itself a second time.
 */
export function useWordSnappedSelection({
  editor,
  enabled,
}: {
  editor: Editor | null;
  enabled: boolean;
}) {
  useEffect(() => {
    if (!editor || !enabled) return;

    const snap = () => {
      const { from, to } = editor.state.selection;
      if (to <= from) return; // a caret snaps to nothing
      const snapped = wordRange(editor, { from, to });
      if (!snapped) return;
      if (snapped.from === from && snapped.to === to) return;
      editor.commands.setTextSelection(snapped);
    };

    editor.on("selectionUpdate", snap);
    return () => {
      editor.off("selectionUpdate", snap);
    };
  }, [editor, enabled]);
}
