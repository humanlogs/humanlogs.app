export type RailItem = {
  anchorId: string;
  /** px from the top of the editor content where this thread is anchored. */
  anchorTop: number;
  /** measured card height in px */
  height: number;
};

/**
 * Vertical layout for the comment rail, in the spirit of Google Docs.
 *
 * Every card wants to sit level with the text it annotates. Cards may never overlap,
 * so a card that would collide with the one above is pushed down — walking top to
 * bottom, each card lands at `max(its anchor, bottom of the previous card)`. Since the
 * rail scrolls with the document, this produces the "stacking" effect: as anchors
 * converge, cards pile up against each other instead of overlapping.
 *
 * The open thread is a special case: being pushed down means it no longer lines up
 * with its own highlight. So the cards above it are pulled up by however much slack
 * they have (they can compress up to the top of the rail, never past it), which brings
 * the active card back toward its anchor without ever pushing anything out of view.
 */
export function layoutRail(
  items: RailItem[],
  activeAnchorId: string | null,
  gap = 8,
): Map<string, number> {
  const sorted = [...items].sort((a, b) => a.anchorTop - b.anchorTop);
  const tops = new Map<string, number>();
  if (sorted.length === 0) return tops;

  // Pass 1 — top to bottom: sit at the anchor, or just below the previous card.
  let cursor = 0;
  for (const item of sorted) {
    const top = Math.max(item.anchorTop, cursor);
    tops.set(item.anchorId, top);
    cursor = top + item.height + gap;
  }

  if (!activeAnchorId) return tops;
  const activeIndex = sorted.findIndex((i) => i.anchorId === activeAnchorId);
  if (activeIndex < 0) return tops;

  const active = sorted[activeIndex];
  const overshoot = (tops.get(active.anchorId) ?? 0) - active.anchorTop;
  if (overshoot <= 0) return tops;

  // Pass 2 — how far can the cards above be compressed? `minTop[i]` is where card i
  // would sit if everything above it were packed tight against the top of the rail.
  let slack = overshoot;
  let minTop = 0;
  for (let i = 0; i <= activeIndex; i++) {
    const item = sorted[i];
    slack = Math.min(slack, (tops.get(item.anchorId) ?? 0) - minTop);
    minTop += item.height + gap;
  }
  if (slack <= 0) return tops;

  for (let i = 0; i <= activeIndex; i++) {
    const item = sorted[i];
    tops.set(item.anchorId, (tops.get(item.anchorId) ?? 0) - slack);
  }

  return tops;
}
