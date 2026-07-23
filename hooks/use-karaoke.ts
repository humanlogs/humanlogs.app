"use client";

import { useEffect, useRef, useState } from "react";

export interface UseKaraokeOptions {
  /** ms of dwell per character of the active word (word length sets the pace). */
  perChar?: number;
  /** extra random ms (0..jitter) added per word so it doesn't feel metronomic. */
  jitter?: number;
  /** extra pause when a word ends a line/sentence. */
  lineEndPause?: number;
  /** whether the word at `index` ends a line/sentence (gets `lineEndPause`). */
  isLineEnd?: (index: number) => boolean;
  /** loop back to the first word after the last one (default false). */
  loop?: boolean;
  /** pause before looping back to the start. */
  loopPause?: number;
  /** run the timeline (set false to freeze, e.g. reduced motion). */
  enabled?: boolean;
  /**
   * Called when a word becomes active — do per-word side effects here (e.g.
   * typing a synonym into it). Return a number to OVERRIDE this word's dwell
   * time in ms; return nothing to use the length-based default.
   */
  onWord?: (index: number, word: string) => number | void;
  /** called once, when the last word's dwell has elapsed (non-loop only). */
  onComplete?: () => void;
}

/**
 * Drives a karaoke "currently spoken" cursor across `words`, dwelling on each
 * one for a time proportional to its length (longer words linger), with a
 * little jitter and an optional pause at line ends. Extracted from the landing
 * transcript demo so the onboarding greeting reads at the same human cadence.
 *
 * Returns the active word index. When it finishes (non-loop) it advances the
 * index one past the last word, so nothing stays highlighted and the whole line
 * reads as "already spoken".
 */
export function useKaraoke(
  words: string[],
  options: UseKaraokeOptions = {},
): number {
  const { enabled = true } = options;
  const [active, setActive] = useState(0);

  // Keep the latest words/options in a ref so the timeline effect runs once and
  // still picks up async changes (e.g. a greeting whose name loads late).
  const cfg = useRef({ words, options });
  useEffect(() => {
    cfg.current = { words, options };
  });

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout>;

    const step = (i: number) => {
      const { words: w, options: o } = cfg.current;
      const {
        perChar = 50,
        jitter = 50,
        lineEndPause = 200,
        isLineEnd,
        loop = false,
        loopPause = 1000,
        onWord,
        onComplete,
      } = o;

      if (i >= w.length) {
        if (loop) {
          timer = setTimeout(() => step(0), loopPause);
        } else {
          setActive(w.length); // past the end: nothing highlighted, all lit
          onComplete?.();
        }
        return;
      }

      setActive(i);
      const word = w[i] ?? "";
      const override = onWord?.(i, word);
      const dwell =
        typeof override === "number"
          ? override
          : perChar * word.length +
            Math.random() * jitter +
            (isLineEnd?.(i) ? lineEndPause : 0);

      timer = setTimeout(() => step(i + 1), dwell);
    };

    step(0);
    return () => clearTimeout(timer);
  }, [enabled]);

  return active;
}
