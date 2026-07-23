"use client";

import { cn } from "@/lib/utils/utils";

/**
 * The "currently spoken" word highlight used by the landing transcript
 * animation (animated-transcript-card) and the onboarding greeting. Shared so
 * both light words up identically.
 */
export const KARAOKE_ACTIVE_CLASS =
  "bg-[color-mix(in_oklab,_rgb(59_130_246)_25%,_transparent)] outline outline-1 outline-[color-mix(in_oklab,_rgb(59_130_246)_50%,_transparent)] outline-offset-1";

export type KaraokeState = "past" | "active" | "future";

/**
 * How already-spoken vs. not-yet-spoken words are dimmed:
 *  - "opacity": fade with the inherited text colour (onboarding greeting, which
 *    sits on a coloured card and must work in light/dark).
 *  - "muted": explicit gray steps (the landing transcript demo on a white card).
 */
export type KaraokeTone = "opacity" | "muted";

const TONE: Record<KaraokeTone, { past: string; future: string }> = {
  opacity: { past: "opacity-100", future: "opacity-25" },
  muted: {
    past: "text-gray-900 dark:text-gray-100",
    future: "text-gray-400 dark:text-gray-600",
  },
};

/** Word state relative to the karaoke cursor. The word at `active` is lit up. */
export function karaokeState(index: number, active: number): KaraokeState {
  if (index === active) return "active";
  return index < active ? "past" : "future";
}

/**
 * A single karaoke word: the shared span that both the transcript demo and the
 * onboarding greeting render for each word. The active word gets the blue
 * highlight box; past/future words are dimmed per `tone`.
 *
 * `snapActive` drops the transition on the active word so it can be edited
 * (typed-into) without the highlight easing — used by the transcript demo.
 */
export function KaraokeWord({
  state,
  tone = "opacity",
  snapActive = false,
  className,
  style,
  children,
}: {
  state: KaraokeState;
  tone?: KaraokeTone;
  snapActive?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const isActive = state === "active";
  return (
    <span
      style={{ marginRight: "0.25rem", ...style }}
      className={cn(
        "inline-block rounded-[5px] px-[1px]",
        isActive && snapActive
          ? "transition-none"
          : "transition-all duration-200",
        isActive
          ? KARAOKE_ACTIVE_CLASS
          : state === "past"
            ? TONE[tone].past
            : TONE[tone].future,
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Presentational karaoke line: renders `text` word by word. Words before
 * `active` are fully lit, the word at `active` gets the highlight box (as if
 * being spoken now), and later words stay dim. Pass `active >= word count` to
 * show the whole line lit with nothing highlighted. Timing is owned by the
 * caller so several lines can be chained deterministically.
 */
export function KaraokeText({
  text,
  active,
  tone,
  className,
}: {
  text: string;
  active: number;
  tone?: KaraokeTone;
  className?: string;
}) {
  const words = text.split(" ");
  return (
    <span className={className}>
      {words.map((word, idx) => (
        <KaraokeWord key={idx} state={karaokeState(idx, active)} tone={tone}>
          {word}
        </KaraokeWord>
      ))}
    </span>
  );
}

/** Number of words in a karaoke line (helper for timeline maths). */
export function wordCount(text: string): number {
  return text.split(" ").length;
}
