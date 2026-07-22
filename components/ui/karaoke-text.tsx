"use client";

import { cn } from "@/lib/utils/utils";

/**
 * Presentational karaoke text: reveals the first `revealed` words at full
 * opacity (the rest stay dim), so words light up one by one like spoken
 * subtitles. Timing is owned by the caller, which keeps chaining several lines
 * deterministic. Pass `revealed="all"` to show everything at once.
 */
export function KaraokeText({
  text,
  revealed,
  className,
}: {
  text: string;
  revealed: number | "all";
  className?: string;
}) {
  const words = text.split(" ");
  const count = revealed === "all" ? words.length : revealed;
  return (
    <span className={className}>
      {words.map((word, idx) => (
        <span
          key={idx}
          className={cn(
            "transition-opacity duration-300",
            idx < count ? "opacity-100" : "opacity-20",
          )}
        >
          {word}
          {idx < words.length - 1 ? " " : ""}
        </span>
      ))}
    </span>
  );
}

/** Number of words in a karaoke line (helper for timeline maths). */
export function wordCount(text: string): number {
  return text.split(" ").length;
}
