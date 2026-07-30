"use client";

import type { Editor } from "@tiptap/react";
import { useCallback, useEffect, useState } from "react";
import { EditorAPI } from "../api";

type Box = { top: number; left: number; width: number; height: number };

/**
 * Draws the selected passage.
 *
 * The coding phase builds its selection with the keyboard while the editor stays
 * blurred — that is what keeps the arrows navigating instead of moving a caret — and a
 * blurred contenteditable draws no selection of its own. So we draw it: one box per
 * line of the range, in the same overlay layer as the active-word highlight.
 */
export function SelectionRangeHighlight({
  editor,
  editorAPI,
  visible,
}: {
  editor: Editor | null;
  editorAPI: EditorAPI;
  visible: boolean;
}) {
  const [boxes, setBoxes] = useState<Box[]>([]);

  const measure = useCallback(() => {
    if (!editor || !visible) return setBoxes([]);
    const { from, to } = editor.state.selection;
    if (to <= from) return setBoxes([]);
    const origin = editorAPI.getBoundingClientRect();
    if (!origin) return setBoxes([]);
    // ProseMirror positions are flat char offsets + 1 (collab/doc-to-segments).
    setBoxes(
      editorAPI
        .getRangeClientRects(from - 1, to - 1)
        .filter((r) => r.width > 0 && r.height > 0)
        .map((r) => ({
          top: r.top - origin.top,
          left: r.left - origin.left,
          width: r.width,
          height: r.height,
        })),
    );
  }, [editor, editorAPI, visible]);

  useEffect(() => {
    if (!editor) return;
    // Measures the live DOM (the selection's client rects), which is only valid
    // after layout — there is nothing to derive during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    measure();
    editor.on("selectionUpdate", measure);
    editor.on("transaction", measure);
    window.addEventListener("resize", measure);
    return () => {
      editor.off("selectionUpdate", measure);
      editor.off("transaction", measure);
      window.removeEventListener("resize", measure);
    };
  }, [editor, measure]);

  if (boxes.length === 0) return null;

  return (
    <>
      {boxes.map((box, i) => (
        <div
          key={i}
          className="pointer-events-none absolute rounded-sm"
          style={{
            top: box.top,
            left: box.left,
            width: box.width,
            height: box.height,
            backgroundColor:
              "color-mix(in oklab, var(--color-blue-500) 22%, transparent)",
            zIndex: 1,
          }}
        />
      ))}
    </>
  );
}
