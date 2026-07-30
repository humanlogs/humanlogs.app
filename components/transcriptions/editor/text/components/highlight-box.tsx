"use client";

import type { CSSProperties } from "react";

/** A box in the editor overlay's coordinate space (relative to the editor's origin). */
export type HighlightBox = {
  top: number;
  left: number;
  width: number;
  height: number;
};

/**
 * The one visual for "this is what the keyboard is pointing at" — the active word, and
 * the selection it grows into.
 *
 * They are the same object seen at two sizes, so they get the same treatment: a
 * selection is not a different kind of mark from the word it started at. Drawing them
 * differently made the coding phase show three overlapping signals at once (the code
 * colour, the active word, the selection) with nothing to say which was which.
 *
 * Outline-forward, and a fill light enough to read a code colour through: the coding
 * phase paints passage backgrounds, and a highlight that competed with them would make
 * both illegible — which is the whole reason this style is shared rather than tuned
 * twice.
 */
export const highlightBoxStyle: CSSProperties = {
  backgroundColor: "color-mix(in oklab, var(--color-blue-500) 12%, transparent)",
  outline: "1.5px solid color-mix(in oklab, var(--color-blue-500) 55%, transparent)",
  outlineOffset: "1px",
  borderRadius: "3px",
};

/**
 * Merge the client rects of a range into one box per line.
 *
 * `Range.getClientRects()` returns a rect per text-node fragment, and a coded passage
 * is split into many fragments (one per distinct set of coding marks) — outlining each
 * would shatter a single selected sentence into a dozen boxes. Rects whose vertical
 * spans overlap belong to the same line and are unioned horizontally.
 */
export function mergeRectsByLine(rects: DOMRect[]): DOMRect[] {
  const sorted = [...rects]
    .filter((r) => r.width > 0 && r.height > 0)
    .sort((a, b) => a.top - b.top || a.left - b.left);

  const lines: DOMRect[] = [];
  for (const rect of sorted) {
    const line = lines[lines.length - 1];
    // Same line when the two overlap vertically by more than half of the shorter
    // one — enough to survive a taller run (a bigger glyph, a nested span) without
    // swallowing the line below.
    const overlap = line
      ? Math.min(line.bottom, rect.bottom) - Math.max(line.top, rect.top)
      : 0;
    if (line && overlap > Math.min(line.height, rect.height) / 2) {
      const left = Math.min(line.left, rect.left);
      const top = Math.min(line.top, rect.top);
      lines[lines.length - 1] = new DOMRect(
        left,
        top,
        Math.max(line.right, rect.right) - left,
        Math.max(line.bottom, rect.bottom) - top,
      );
    } else {
      lines.push(new DOMRect(rect.left, rect.top, rect.width, rect.height));
    }
  }
  return lines;
}
