"use client";

import { optionForLetter, type CodingOption } from "@/lib/codebooks/coding";
import { useEffect, useRef } from "react";

/**
 * Driving the coding phase from the keyboard.
 *
 * Coding a whole interview is hundreds of small decisions, so the keyboard has to
 * carry it: select, press a letter, move on. Each code on screen answers to a letter —
 * "A" for the first, "B" for the second. A code with sub-codes applies on that same
 * one keystroke and then puts its sub-codes where the themes were, so the next letter
 * refines what was just said instead of starting over. Escape steps back out.
 *
 * Ctrl+Z takes back the last code applied or retracted. It cannot ride the editor's
 * undo stack — coding marks are deliberately kept out of it, since undo only knows
 * about the document and would orphan the row it points at — so coding keeps its own,
 * which is also the only history the researcher has in mind while coding.
 *
 * The letters are only bound in the coding phase, where the document is read-only and
 * nothing else wants them.
 */
export function useCodingShortcuts({
  enabled,
  level,
  onPick,
  onBack,
  onUndo,
  canGoBack,
}: {
  enabled: boolean;
  /** The codes currently shown — the letters are read against these. */
  level: CodingOption[];
  onPick: (option: CodingOption) => void;
  onBack: () => void;
  onUndo: () => void;
  canGoBack: boolean;
}) {
  // The handler is bound once per `enabled` flip, so everything that moves under it
  // goes through refs rather than re-binding on every render.
  const ref = useRef({ level, onPick, onBack, onUndo, canGoBack });
  useEffect(() => {
    ref.current = { level, onPick, onBack, onUndo, canGoBack };
  });

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      // Never eat a keystroke meant for a form or for text being typed elsewhere.
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (target?.isContentEditable) return;

      if ((event.metaKey || event.ctrlKey) && !event.altKey) {
        if (event.key.toLowerCase() !== "z") return;
        event.preventDefault();
        ref.current.onUndo();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "Escape") {
        if (!ref.current.canGoBack) return;
        event.preventDefault();
        // Stop here, in the capture phase: Escape also clears the selection, and
        // stepping back out of a group while dropping the passage it was about is
        // two things at once. Closing the group first is the one the researcher
        // asked for; a second Escape then clears the selection.
        event.stopPropagation();
        ref.current.onBack();
        return;
      }

      if (!/^[a-zA-Z]$/.test(event.key)) return;
      const option = optionForLetter(ref.current.level, event.key);
      if (!option) return;

      event.preventDefault();
      ref.current.onPick(option);
    };

    document.addEventListener("keydown", onKeyDown, { capture: true });
    return () =>
      document.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [enabled]);
}
