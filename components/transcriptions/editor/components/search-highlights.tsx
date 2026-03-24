"use client";

import { HighlightPosition } from "../hooks/use-search-highlights";

interface SearchHighlightsProps {
  highlights: HighlightPosition[];
}

export function SearchHighlights({ highlights }: SearchHighlightsProps) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {highlights.map((highlight, index) => (
        <div
          key={index}
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
