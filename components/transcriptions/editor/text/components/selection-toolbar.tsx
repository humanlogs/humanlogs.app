"use client";

import { useTranslations } from "@/components/locale-provider";
import { Separator } from "@base-ui/react";
import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  Bold,
  Italic,
  MessageSquarePlus,
  Strikethrough,
  Underline,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { EditorAPI } from "../api";

type Format = "b" | "i" | "u" | "s";

interface SelectionToolbarProps {
  editor: Editor | null;
  editorAPI: EditorAPI;
  canWrite: boolean;
  applyFormat: (format: Format) => void;
  activeFormats: Set<Format>;
  /** Anchor a comment on the current selection. */
  onComment: () => void;
}

const FORMATS: { key: Format; icon: typeof Bold; label: string; className: string }[] =
  [
    { key: "b", icon: Bold, label: "toolbar.bold", className: "font-bold" },
    { key: "i", icon: Italic, label: "toolbar.italic", className: "italic" },
    {
      key: "u",
      icon: Underline,
      label: "toolbar.underline",
      className: "underline",
    },
    {
      key: "s",
      icon: Strikethrough,
      label: "toolbar.strikethrough",
      className: "",
    },
  ];

/** Smallest rectangle containing all of `rects`. */
function unionRect(rects: DOMRect[]): DOMRect {
  const left = Math.min(...rects.map((r) => r.left));
  const top = Math.min(...rects.map((r) => r.top));
  const right = Math.max(...rects.map((r) => r.right));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  return new DOMRect(left, top, right - left, bottom - top);
}

/**
 * The formatting bar that follows a text selection, mirroring the header toolbar so
 * the same actions are reachable without travelling to the top of the page.
 *
 * Every control acts on `onMouseDown` with the default prevented: `applyFormat` and the
 * comment anchor both read the CURRENT selection, and a plain click would blur the
 * editor and collapse it before the handler ever ran.
 */
export function SelectionToolbar({
  editor,
  editorAPI,
  canWrite,
  applyFormat,
  activeFormats,
  onComment,
}: SelectionToolbarProps) {
  const t = useTranslations("editor");
  const menuRef = useRef<HTMLDivElement>(null);

  // Position changes are eased, EXCEPT while scrolling: the menu is re-anchored on
  // every scroll frame, and easing that would leave it visibly lagging behind the text
  // it belongs to. The attribute switches the transition off for the duration.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      const el = menuRef.current;
      if (!el) return;
      el.setAttribute("data-scrolling", "");
      clearTimeout(timer);
      timer = setTimeout(() => el.removeAttribute("data-scrolling"), 120);
    };
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      clearTimeout(timer);
    };
  }, []);

  if (!editor || !canWrite) return null;

  return (
    <BubbleMenu
      ref={menuRef}
      editor={editor}
      // Default is 250ms, which reads as the bar being slow to appear rather than as
      // debouncing.
      updateDelay={100}
      options={{
        // Below the selection, as a reading aid rather than something covering the line
        // being worked on; `flip` still lifts it above near the bottom of the viewport.
        placement: "bottom",
        offset: 8,
        flip: true,
        shift: true,
        // The editor sits inside several `overflow-hidden` wrappers — an absolutely
        // positioned menu would be clipped by them, a fixed one is not.
        strategy: "fixed",
        // Adopt that strategy BEFORE the first measurement, not after it.
        //
        // Floating UI reads the menu's CURRENT `position` to decide what the
        // coordinates it returns are relative to — but the plugin only writes
        // `position: fixed` once they have been computed, and the element starts
        // out `absolute` (the React wrapper's initial style). So the very first
        // show measured against the editor's offset parent and then applied the
        // result as viewport coordinates: the bar appeared off by that parent's
        // position and scroll, and only the next selection was placed correctly.
        // `onShow` runs after the element is appended and before the position is
        // computed, which is exactly where the two have to agree.
        onShow: () => {
          const el = menuRef.current;
          if (!el) return;
          el.style.position = "fixed";
          el.style.width = "max-content";
        },
        // Anchor on ONE line of the selection rather than on the box enclosing all of
        // them: for a selection spanning several lines that box is as wide as the
        // paragraph, and centring under it put the bar far from the text. With the real
        // per-line rects below, this middleware picks the last line for a `bottom`
        // placement (and the first one if `flip` lifts it above).
        inline: true,
        // Reveal only once the computed position has been applied. `show()` appends the
        // menu BEFORE positioning it, so it is briefly carrying the coordinates of the
        // previous selection — revealing on show would flash it at the wrong place and,
        // worse, animate the correction.
        onUpdate: () => {
          const el = menuRef.current;
          if (!el || el.hasAttribute("data-show")) return;
          // One painted frame in the hidden state, or there is nothing to ease from:
          // the element is re-appended on every show, so it has no previous computed
          // style of its own.
          requestAnimationFrame(() => {
            if (menuRef.current?.isConnected) {
              menuRef.current.setAttribute("data-show", "");
            }
          });
        },
        onHide: () => menuRef.current?.removeAttribute("data-show"),
      }}
      getReferencedVirtualElement={() => {
        // The plugin's own reference reports a single rect (the union), which gives
        // `inline` nothing to work with. These are the true per-line rectangles.
        const { from, to } = editor.state.selection;
        if (from === to) return null;
        const rects = editorAPI
          .getRangeClientRects(from - 1, to - 1)
          .filter((r) => r.width > 0 || r.height > 0);
        if (rects.length === 0) return null;
        return {
          getClientRects: () => rects,
          getBoundingClientRect: () => unionRect(rects),
        };
      }}
      shouldShow={({ editor: ed, from, to }) => {
        if (!ed.isEditable) return false;
        // Navigate mode blurs the editor and drives its own highlight; a floating bar
        // there would follow a selection the user is no longer editing.
        if (!ed.isFocused) return false;
        if (from === to) return false; // a caret, not a selection
        return ed.state.doc.textBetween(from, to, " ").trim().length > 0;
      }}
      className="group z-30 data-[show]:transition-[left,top] data-[show]:duration-150 data-[show]:ease-out data-[scrolling]:transition-none"
    >
      {/* The plugin owns the outer element's position, visibility and opacity, so the
          entrance animation lives on this inner card where nothing overwrites it.
          There is no exit animation to match: `hide()` detaches the element outright. */}
      <div className="bg-popover flex origin-top -translate-y-1 scale-95 items-center gap-0 rounded-lg border p-1 opacity-0 shadow-md transition-[opacity,transform] duration-150 ease-out group-data-[show]:translate-y-0 group-data-[show]:scale-100 group-data-[show]:opacity-100">
        {FORMATS.map(({ key, icon: Icon, label, className }) => (
          <Button
            key={key}
            variant={activeFormats.has(key) ? "default" : "ghost"}
            size="sm"
            onMouseDown={(e) => {
              e.preventDefault(); // keep the selection alive
              applyFormat(key);
            }}
            className={`h-7 w-7 p-0 ${className}`}
            title={t(label)}
            aria-label={t(label)}
            aria-pressed={activeFormats.has(key)}
          >
            <Icon className="h-3.5 w-3.5" />
          </Button>
        ))}

        <Separator
          orientation="vertical"
          className="mx-1.5 h-4 w-px bg-slate-500/20"
        />

        <Button
          variant="ghost"
          size="sm"
          onMouseDown={(e) => {
            e.preventDefault();
            onComment();
          }}
          className="h-7 w-7 p-0"
          title={t("toolbar.comment")}
          aria-label={t("toolbar.comment")}
        >
          <MessageSquarePlus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </BubbleMenu>
  );
}
