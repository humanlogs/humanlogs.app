"use client";

import { useTranslations } from "@/components/locale-provider";
import { MessageSquare } from "lucide-react";
import { EditorAPI } from "../api";
import { useCommentPositions } from "../hooks/use-comment-positions";

interface CommentColumnProps {
  editorAPI: EditorAPI;
  /** Anchor id of the currently open thread, for highlighting its indicator. */
  activeAnchorId: string | null;
  onOpenThread: (anchorId: string) => void;
}

/**
 * Right-hand gutter mirroring the left SpeakerColumn: an absolutely-positioned orange
 * indicator per comment thread, aligned to the first line of its anchored text.
 * Clicking an indicator opens that thread's popover.
 */
export function CommentColumn({
  editorAPI,
  activeAnchorId,
  onOpenThread,
}: CommentColumnProps) {
  const t = useTranslations("editor");
  const { positions } = useCommentPositions(editorAPI);

  // One indicator per line, not per thread: several threads can be anchored on the
  // same line, and their dots would otherwise stack on top of each other. Opening any
  // of them shows the neighbouring threads anyway.
  const lines = new Map<
    number,
    { top: number; anchorIds: string[] }
  >();
  for (const pos of positions) {
    const line = Math.round(pos.top / 4) * 4;
    const entry = lines.get(line);
    if (entry) entry.anchorIds.push(pos.anchorId);
    else lines.set(line, { top: pos.top, anchorIds: [pos.anchorId] });
  }

  return (
    <div className="relative w-6 shrink-0">
      {Array.from(lines.values()).map((pos) => {
        const active = pos.anchorIds.includes(activeAnchorId ?? "");
        return (
          <button
            key={pos.anchorIds[0]}
            type="button"
            data-comment-gutter=""
            title={t("comments.indicator")}
            aria-label={t("comments.indicator")}
            onClick={() => onOpenThread(pos.anchorIds[0])}
            className={`absolute left-0 flex h-5 w-5 items-center justify-center rounded-full transition-colors ${
              active
                ? "bg-orange-500 text-white"
                : "bg-orange-500/15 text-orange-500 hover:bg-orange-500/25"
            }`}
            style={{ top: pos.top }}
          >
            <MessageSquare className="h-3 w-3" />
          </button>
        );
      })}
    </div>
  );
}
