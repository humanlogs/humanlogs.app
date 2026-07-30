"use client";

import {
  CodingBackRow,
  CodingLevelList,
} from "@/components/codebooks/coding-menu";
import { useTranslations } from "@/components/locale-provider";
import type { CodingOption } from "@/lib/codebooks/coding";
import type { Editor } from "@tiptap/react";
import { MessageSquarePlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { EditorAPI } from "../api";

/** Distance between the selection and the panel, and from the viewport edges. */
const GAP = 8;
const MARGIN = 8;
const WIDTH = 260;

/**
 * The floating bar of the coding phase — the counterpart of {@link SelectionToolbar},
 * carrying the code list and the comment action instead of the formatting controls the
 * phase has no use for.
 *
 * The list is ALREADY OPEN. Coding is the one thing this phase does, so making the
 * researcher click a "Code" button to reveal the codes would charge a click for the
 * only reason the bar appeared. Commenting sits at the bottom, past a separator: it is
 * the other thing you can do to a passage, and last is where you look for it once the
 * codes have not matched.
 *
 * It does NOT use TipTap's `BubbleMenu`, which only shows for an editable, focused
 * editor. Here the document is read-only and the selection is usually built with the
 * keyboard while the editor stays blurred (that is what keeps the arrows navigating),
 * so the panel is positioned from the selection's own client rects instead.
 */
export function CodingSelectionToolbar({
  editor,
  editorAPI,
  level,
  trail,
  onBack,
  appliedKeys,
  onPick,
  onComment,
  canWrite,
}: {
  editor: Editor | null;
  editorAPI: EditorAPI;
  /** The codes currently shown: the top level, or the sub-codes we opened into. */
  level: CodingOption[];
  trail: CodingOption[];
  onBack: () => void;
  appliedKeys: Set<string>;
  onPick: (option: CodingOption) => void;
  onComment: () => void;
  canWrite: boolean;
}) {
  const t = useTranslations("codebook.coding");
  const [position, setPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);

  const measure = useCallback(() => {
    if (!editor) return setPosition(null);
    const { from, to } = editor.state.selection;
    if (to <= from) return setPosition(null);
    // ProseMirror positions are flat char offsets + 1 (collab/doc-to-segments).
    const rects = editorAPI
      .getRangeClientRects(from - 1, to - 1)
      .filter((r) => r.width > 0 || r.height > 0);
    if (rects.length === 0) return setPosition(null);

    // Anchor on the LAST line of the selection, not on the box enclosing all of them:
    // for a selection spanning several lines that box is as wide as the paragraph, and
    // centring under it puts the panel far from the text it belongs to.
    const last = rects[rects.length - 1];
    const centre = last.left + last.width / 2;
    setPosition({
      left: Math.min(
        Math.max(centre, MARGIN + WIDTH / 2),
        window.innerWidth - MARGIN - WIDTH / 2,
      ),
      top: last.bottom + GAP,
    });
  }, [editor, editorAPI]);

  useEffect(() => {
    if (!editor) return;
    // Measures the live DOM (the selection's client rects), which is only valid
    // after layout — there is nothing to derive during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    measure();
    editor.on("selectionUpdate", measure);
    editor.on("transaction", measure);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      editor.off("selectionUpdate", measure);
      editor.off("transaction", measure);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [editor, measure]);

  if (!position || !canWrite || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed z-30 -translate-x-1/2"
      style={{ left: position.left, top: position.top, width: WIDTH }}
    >
      <div className="rounded-lg border bg-popover p-1 shadow-md">
        {/* Bounded: a codebook with thirty codes must not push the comment action
            off the screen, and the list is the part that can grow. */}
        <div className="max-h-[40vh] overflow-y-auto">
          {trail.length > 0 && (
            <>
              <CodingBackRow
                parent={trail[trail.length - 1]}
                onBack={onBack}
              />
              <div className="my-1 h-px bg-border" />
            </>
          )}
          <CodingLevelList
            level={level}
            appliedKeys={appliedKeys}
            onPick={onPick}
          />
          {level.length === 0 && (
            <p className="px-2 py-2 text-xs text-muted-foreground">
              {t("noCodes")}
            </p>
          )}
        </div>

        <div className="my-1 h-px bg-border" />

        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
          onMouseDown={(e) => {
            e.preventDefault(); // keep the selection alive
            onComment();
          }}
        >
          <MessageSquarePlus className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{t("comment")}</span>
        </button>
      </div>
    </div>,
    document.body,
  );
}
