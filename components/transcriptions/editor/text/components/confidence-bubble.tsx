"use client";

import { useTranslations } from "@/components/locale-provider";
import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Check } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { EditorAPI } from "../api";
import { confidenceAt, confidenceRangeAt } from "../extensions/confidence-mark";
import { LOW_CONFIDENCE_MARK } from "../utils/confidence";

interface ConfidenceBubbleProps {
  editor: Editor | null;
  editorAPI: EditorAPI;
}

/** Smallest rectangle containing all of `rects`. */
function unionRect(rects: DOMRect[]): DOMRect {
  const left = Math.min(...rects.map((r) => r.left));
  const top = Math.min(...rects.map((r) => r.top));
  const right = Math.max(...rects.map((r) => r.right));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  return new DOMRect(left, top, right - left, bottom - top);
}

/**
 * One button under a doubtful word the caret is in (or a selection containing some):
 * "this was heard right". Correcting the word needs no button — typing in it already
 * clears the doubt (see the plugin in confidence-mark.ts); this is for the far more
 * common case of a word that was fine all along.
 *
 * Deliberately a single small control, anchored on the WORD rather than on a whole
 * selection: the general selection toolbar is switched off for covering the line
 * being edited, and this one only ever appears on a word the reader has just
 * clicked, to be dismissed by the click that answers it.
 */
export function ConfidenceBubble({ editor, editorAPI }: ConfidenceBubbleProps) {
  const t = useTranslations("editor");
  const menuRef = useRef<HTMLDivElement>(null);

  if (!editor) return null;
  const type = editor.schema.marks[LOW_CONFIDENCE_MARK];
  if (!type) return null;

  const confidence = confidenceAt(editor.state, type);

  return (
    <BubbleMenu
      ref={menuRef}
      editor={editor}
      pluginKey="confidenceBubble"
      updateDelay={100}
      options={{
        placement: "bottom",
        offset: 6,
        flip: true,
        shift: true,
        // Same reasons as the selection toolbar: escape the overflow-hidden wrappers,
        // and adopt `fixed` before the first measurement.
        strategy: "fixed",
        onShow: () => {
          const el = menuRef.current;
          if (!el) return;
          el.style.position = "fixed";
          el.style.width = "max-content";
        },
      }}
      getReferencedVirtualElement={() => {
        const range = confidenceRangeAt(editor.state, type);
        if (!range) return null;
        const rects = editorAPI
          .getRangeClientRects(range.from - 1, range.to - 1)
          .filter((r) => r.width > 0 || r.height > 0);
        if (rects.length === 0) return null;
        return {
          getClientRects: () => rects,
          getBoundingClientRect: () => unionRect(rects),
        };
      }}
      shouldShow={({ editor: ed, state }) => {
        if (!ed.isEditable || !ed.isFocused) return false;
        return confidenceRangeAt(state, type) !== null;
      }}
      className="z-30"
    >
      <div className="bg-popover flex items-center gap-1.5 rounded-lg border py-0.5 pl-2 pr-0.5 shadow-md">
        {confidence !== undefined && (
          <span className="text-muted-foreground text-xs tabular-nums">
            {t("confidence.score", { value: Math.round(confidence * 100) })}
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          onMouseDown={(e) => {
            e.preventDefault(); // keep the caret where it is
            editor.chain().validateConfidence().run();
          }}
          className="h-6 gap-1 px-1.5 text-xs"
          title={t("confidence.validateHint")}
        >
          <Check className="h-3.5 w-3.5" />
          {t("confidence.validate")}
        </Button>
      </div>
    </BubbleMenu>
  );
}
