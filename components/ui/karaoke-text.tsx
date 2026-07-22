"use client";

import { cn } from "@/lib/utils/utils";

/**
 * The "currently spoken" word highlight used by the landing transcript
 * animation (animated-transcript-card). Shared so the onboarding greeting and
 * the transcript demo light words up identically.
 */
export const KARAOKE_ACTIVE_CLASS =
  "bg-[color-mix(in_oklab,_rgb(59_130_246)_25%,_transparent)] outline outline-1 outline-[color-mix(in_oklab,_rgb(59_130_246)_50%,_transparent)] outline-offset-1";

/**
 * Presentational karaoke text: renders words with the transcript animation's
 * look. Words before `active` are fully lit, the word at `active` gets the blue
 * highlight box (as if being spoken right now), and later words stay dim. Pass
 * `active >= word count` to show the whole line lit with no highlight.
 * Timing is owned by the caller so several lines can be chained deterministically.
 */
export function KaraokeText({
  text,
  active,
  className,
}: {
  text: string;
  active: number;
  className?: string;
}) {
  const words = text.split(" ");
  return (
    <span className={className}>
      {words.map((word, idx) => {
        const isActive = idx === active;
        const isPast = idx < active;
        return (
          <span
            key={idx}
            style={{ marginRight: "0.25rem" }}
            className={cn(
              "inline-block rounded-[5px] px-[1px] transition-all duration-200",
              isActive
                ? KARAOKE_ACTIVE_CLASS
                : isPast
                  ? "opacity-100"
                  : "opacity-25",
            )}
          >
            {word}
          </span>
        );
      })}
    </span>
  );
}

/** Number of words in a karaoke line (helper for timeline maths). */
export function wordCount(text: string): number {
  return text.split(" ").length;
}
