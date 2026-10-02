"use client";

import type { Editor } from "@tiptap/react";
import { useCallback, useEffect, useState } from "react";
import { EditorAPI } from "../api";
import {
  highlightBoxStyle,
  mergeRectsByLine,
  type HighlightBox,
} from "./highlight-box";

/**
 * Draws the selected passage.
 *
 * Navigate mode builds its selection with the keyboard while the editor stays blurred
 * — that is what keeps the arrows navigating instead of moving a caret — and a blurred
 * contenteditable draws no selection of its own. So we draw it, in the same overlay
 * layer and with the same style as the active word (see `highlightBoxStyle`): the
 * selection is the active word grown, not a second kind of marking.
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
  const [boxes, setBoxes] = useState<HighlightBox[]>([]);

  const measure = useCallback(() => {
    if (!editor || !visible) return setBoxes([]);
    const { from, to } = editor.state.selection;
    if (to <= from) return setBoxes([]);
    const origin = editorAPI.getBoundingClientRect();
    if (!origin) return setBoxes([]);
    // ProseMirror positions are flat char offsets + 1 (collab/doc-to-segments).
    setBoxes(
      mergeRectsByLine(editorAPI.getRangeClientRects(from - 1, to - 1)).map(
        (r) => ({
          top: r.top - origin.top,
          left: r.left - origin.left,
          width: r.width,
          height: r.height,
        }),
      ),
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
          className="pointer-events-none absolute"
          style={{
            ...highlightBoxStyle,
            top: box.top,
            left: box.left,
            width: box.width,
            height: box.height,
            zIndex: 1,
          }}
        />
      ))}
    </>
  );
}
