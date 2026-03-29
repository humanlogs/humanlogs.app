"use client";

import { useEffect, useRef } from "react";
import { HighlightPosition } from "../hooks/use-search-highlights";

interface SearchHighlightsProps {
  highlights: HighlightPosition[];
}

export function SearchHighlights({ highlights }: SearchHighlightsProps) {
  const currentHighlightRef = useRef<HTMLDivElement>(null);

  // Scroll to current highlight when it changes
  useEffect(() => {
    if (currentHighlightRef.current) {
      currentHighlightRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    }
  }, [highlights.findIndex((h) => h.isCurrent)]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {highlights.map((highlight, index) => (
        <div
          key={index}
          ref={highlight.isCurrent ? currentHighlightRef : null}
          className={`absolute rounded-sm ${
            highlight.isCurrent
              ? "bg-orange-400/50"
              : "bg-yellow-300/40 dark:bg-yellow-500/30"
          }`}
          style={{
            top: `${highlight.top}px`,
            left: `${highlight.left}px`,
            width: `${highlight.width}px`,
            height: `${highlight.height}px`,
          }}
        />
      ))}
    </div>
  );
}
