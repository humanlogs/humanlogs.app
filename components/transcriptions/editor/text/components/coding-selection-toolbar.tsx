"use client";

import { CodingMenuItems } from "@/components/codebooks/coding-menu";
import { useTranslations } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import type { CodingOption } from "@/lib/codebooks/coding";
import { Separator } from "@base-ui/react";
import type { Editor } from "@tiptap/react";
import { MessageSquarePlus, TagsIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { EditorAPI } from "../api";

/** Where the bar sits relative to the selection. */
const GAP = 8;

/**
 * The floating bar of the coding phase — the counterpart of {@link SelectionToolbar},
 * carrying the code menu and the comment button instead of the formatting controls the
 * phase has no use for.
 *
 * It does NOT use TipTap's `BubbleMenu`, which only shows for an editable, focused
 * editor. Here the document is read-only and the selection is usually built with the
 * keyboard while the editor stays blurred (that is what keeps the arrows navigating),
 * so the bar is positioned from the selection's own client rects instead.
 */
export function CodingSelectionToolbar({
  editor,
  editorAPI,
  options,
  appliedKeys,
  onPick,
  onComment,
  canWrite,
}: {
  editor: Editor | null;
  editorAPI: EditorAPI;
  options: CodingOption[];
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
    // centring under it puts the bar far from the text it belongs to.
    const last = rects[rects.length - 1];
    setPosition({
      left: last.left + last.width / 2,
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
      style={{ left: position.left, top: position.top }}
    >
      <div className="flex items-center gap-0 rounded-lg border bg-popover p-1 shadow-md">
        <DropdownMenu
          align="start"
          position="bottom"
          trigger={
            <span className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs transition-colors hover:bg-accent">
              <TagsIcon className="h-3.5 w-3.5" />
              {t("apply")}
            </span>
          }
        >
          <CodingMenuItems
            options={options}
            appliedKeys={appliedKeys}
            onPick={onPick}
          />
        </DropdownMenu>

        <Separator
          orientation="vertical"
          className="mx-1.5 h-4 w-px bg-slate-500/20"
        />

        <Button
          variant="ghost"
          size="sm"
          onMouseDown={(e) => {
            e.preventDefault(); // keep the selection alive
            onComment();
          }}
          className="h-7 w-7 p-0"
          title={t("comment")}
          aria-label={t("comment")}
        >
          <MessageSquarePlus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>,
    document.body,
  );
}
