"use client";

import {
  optionForSequence,
  sequenceHasContinuation,
  type CodingOption,
} from "@/lib/codebooks/coding";
import { useEffect, useRef, useState } from "react";

/** How long a half-typed sequence waits for its next letter before giving up. */
const PENDING_TIMEOUT_MS = 2500;

/**
 * Typing a code onto the selected passage.
 *
 * Coding a whole interview is hundreds of small decisions, so the keyboard has to carry
 * it: select, press a letter, move on. Each code answers to a letter — "A" for the
 * first, "B" for the second — and sub-codes restart at "A" inside their parent, so "AB"
 * is "second sub-code of the first code" (see `buildCodingOptions`).
 *
 * A code with sub-codes does NOT apply on its own letter: the next keystroke may still
 * be a sub-code, and applying the theme only to retract it a moment later is worse than
 * waiting. It stays pending — shown in the coding bar — until a letter picks a child,
 * Enter confirms the parent itself, Escape cancels, or the sequence times out.
 *
 * Only ever active with a selection: without one there is nothing to code, and the
 * letters would otherwise be swallowed from a document the researcher is just reading.
 */
export function useCodingShortcuts({
  enabled,
  options,
  onPick,
}: {
  enabled: boolean;
  options: CodingOption[];
  onPick: (option: CodingOption) => void;
}) {
  const [pending, setPending] = useState<string>("");
  // The handler is bound once per `enabled` flip, so the moving parts it reads —
  // the menu and the callback — go through refs rather than re-binding on every
  // render (and losing a half-typed sequence each time).
  const optionsRef = useRef(options);
  const onPickRef = useRef(onPick);
  const pendingRef = useRef("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Declared BEFORE the listener effect so the handler it binds never reads a stale
  // menu on the render that introduced it.
  useEffect(() => {
    optionsRef.current = options;
    onPickRef.current = onPick;
  });

  useEffect(() => {
    const reset = () => {
      pendingRef.current = "";
      setPending("");
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    if (!enabled) {
      reset();
      return;
    }

    const arm = (sequence: string) => {
      pendingRef.current = sequence;
      setPending(sequence);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(reset, PENDING_TIMEOUT_MS);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      // Never eat a keystroke meant for a form or for text being typed elsewhere.
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (target?.isContentEditable) return;

      if (event.key === "Escape") {
        if (!pendingRef.current) return;
        event.preventDefault();
        reset();
        return;
      }

      if (event.key === "Enter") {
        const option = pendingRef.current
          ? optionForSequence(optionsRef.current, pendingRef.current)
          : null;
        if (!option) return;
        event.preventDefault();
        reset();
        onPickRef.current(option);
        return;
      }

      if (!/^[a-zA-Z]$/.test(event.key)) return;

      const sequence = pendingRef.current + event.key.toUpperCase();
      const option = optionForSequence(optionsRef.current, sequence);
      if (!option) {
        // A letter that leads nowhere: drop the whole sequence rather than
        // silently ignore it, so the next letter starts from a known state.
        reset();
        return;
      }

      event.preventDefault();
      if (sequenceHasContinuation(optionsRef.current, sequence)) {
        arm(sequence);
        return;
      }
      reset();
      onPickRef.current(option);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      reset();
    };
  }, [enabled]);

  return {
    /** The half-typed sequence, e.g. "A" — shown so the researcher sees the wait. */
    pending,
    /** The code that pressing Enter would apply right now, if any. */
    pendingOption: pending ? optionForSequence(options, pending) : null,
  };
}
