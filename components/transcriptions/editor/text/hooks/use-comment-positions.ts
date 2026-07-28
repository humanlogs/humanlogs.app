"use client";

import { useEffect, useRef, useState } from "react";
import { EditorAPI } from "../api";

export interface CommentPosition {
  anchorId: string;
  /** px from the top of the editor's content area */
  top: number;
}

const signature = (positions: CommentPosition[]): string =>
  positions.map((p) => `${p.anchorId}:${Math.round(p.top)}`).join("|");

/**
 * One position per comment thread anchored in the document, for the right-gutter
 * indicators. Mirrors {@link import("./use-speaker-positions").useSpeakerPositions}:
 * recomputes on doc/comment changes, scroll and resize, coalesced into a single rAF,
 * and skips the setState when nothing moved.
 */
export function useCommentPositions(editorAPI: EditorAPI): {
  positions: CommentPosition[];
} {
  const [positions, setPositions] = useState<CommentPosition[]>([]);
  const rafRef = useRef<number | null>(null);
  const sigRef = useRef<string>("");

  useEffect(() => {
    const schedule = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const next = editorAPI.getCommentPositions();
        const sig = signature(next);
        if (sig === sigRef.current) return;
        sigRef.current = sig;
        setPositions(next);
      });
    };

    schedule();

    // The editor reflows whenever its width changes (opening/collapsing the comment
    // rail, the sidebar, a window resize), which moves every anchor. Window events
    // don't cover that, so watch the element itself.
    const observer = new ResizeObserver(schedule);
    let observed: HTMLElement | null = null;
    const observe = () => {
      const el = editorAPI.getEditorElement();
      if (!el || el === observed) return;
      if (observed) observer.unobserve(observed);
      observer.observe(el);
      observed = el;
      schedule();
    };
    observe();

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    editorAPI.addListener("speakersOffsets", schedule);
    editorAPI.addListener("change", schedule);
    editorAPI.addListener("commentsChange", schedule);
    editorAPI.addListener("ready", observe);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      editorAPI.removeListener("speakersOffsets", schedule);
      editorAPI.removeListener("change", schedule);
      editorAPI.removeListener("commentsChange", schedule);
      editorAPI.removeListener("ready", observe);
    };
    // editorAPI is a stable ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { positions };
}
