"use client";

import { RefObject, useCallback, useEffect, useState } from "react";
import { TranscriptionSegment } from "../../../../hooks/use-api";

export interface SpeakerPosition {
  speakerId: string;
  /** Index of this speaker turn (0-based, used for colour cycling) */
  index: number;
  /** px from the top of the editor's visible area */
  top: number;
}

/**
 * Returns one position entry for every speaker *change* in the editor,
 * i.e. each time the speakerId on word spans transitions to a different value.
 * Re-measures on: segment changes, editor scroll, resize, and DOM mutations.
 */
export function useSpeakerPositions(
  editorRef: RefObject<HTMLDivElement | null>,
  segments: TranscriptionSegment[],
): SpeakerPosition[] {
  const [positions, setPositions] = useState<SpeakerPosition[]>([]);

  const recalculate = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const editorRect = editor.getBoundingClientRect();
    const result: SpeakerPosition[] = [];
    let prevSpeakerId: string | null = null;
    let paragraphBreak = false;
    let turnIndex = 0;

    // Query all typed spans so we can detect \n\n paragraph breaks between
    // word spans that belong to the same speaker.
    const spans = editor.querySelectorAll<HTMLElement>("[data-type]");

    for (const span of Array.from(spans)) {
      const type = span.dataset.type;

      if (type === "spacing") {
        if (span.textContent?.includes("\n\n")) paragraphBreak = true;
        continue;
      }

      if (type !== "word") continue;
      const speakerId = span.dataset.speaker;
      if (!speakerId) continue;

      if (speakerId !== prevSpeakerId || paragraphBreak) {
        const rect = span.getBoundingClientRect();
        const top = rect.top - editorRect.top + rect.height / 2;
        result.push({ speakerId, index: turnIndex++, top });
        prevSpeakerId = speakerId;
        paragraphBreak = false;
      }
    }

    setPositions(result);
    // editorRef is a stable ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-measure after React has committed the new segments to the DOM
  useEffect(() => {
    const id = requestAnimationFrame(recalculate);
    return () => cancelAnimationFrame(id);
  }, [segments, recalculate]);

  // Re-measure on editor scroll
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.addEventListener("scroll", recalculate, { passive: true });
    return () => editor.removeEventListener("scroll", recalculate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recalculate]);

  // Re-measure when the editor is resized (window resize, sidebar toggle, etc.)
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const ro = new ResizeObserver(recalculate);
    ro.observe(editor);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recalculate]);

  // Re-measure on any DOM mutation inside the editor (typing reflows layout)
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const mo = new MutationObserver(recalculate);
    mo.observe(editor, { childList: true, subtree: true, characterData: true });
    return () => mo.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recalculate]);

  return positions;
}
