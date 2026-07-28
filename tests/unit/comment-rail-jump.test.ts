import { describe, expect, it } from "vitest";
import { computeRailJump } from "@/components/transcriptions/editor/text/utils/comment-rail-layout";

/**
 * Rail items sit level with the text they annotate, so the rail alone cannot tell an
 * unannotated stretch from the end of the thread list. The arrows answer that: each
 * side shows whenever something is hidden that way — INDEPENDENTLY, and regardless of
 * whether other comments are currently on screen. This pins down when they show and
 * where they land, for both the collapsed dots and the open cards.
 */

/** A collapsed gutter dot: 20px tall, at `top` in column coordinates. */
const dot = (top: number) => ({ top, height: 20 });

// A 1000px-tall window with a 140px sticky header, so the band is 148..992 and the
// parking line sits a quarter in: 148 + max(80, 211) = 359.
const band = { top: 148, bottom: 992 };
const PARK = 359;

describe("computeRailJump", () => {
  it("shows nothing when the only comment is on screen", () => {
    // Column top at 0 → the dot at 400 sits inside the band, nothing either side.
    expect(computeRailJump([dot(400)], 0, band, 0)).toEqual({
      up: null,
      down: null,
    });
  });

  it("still points at hidden comments while another is on screen", () => {
    // dot(400) is visible, but one is hidden above and one below — both arrows show.
    const jump = computeRailJump([dot(-500), dot(400), dot(3000)], 0, band, 1000);
    expect(jump.up).toBe(1000 + (-500 - PARK));
    expect(jump.down).toBe(1000 + (3000 - PARK));
  });

  it("shows only the side that actually has something hidden", () => {
    // Visible dot plus one below: no upward arrow, since nothing is hidden above.
    expect(computeRailJump([dot(400), dot(3000)], 0, band, 0)).toEqual({
      up: null,
      down: 3000 - PARK,
    });
  });

  it("offers both directions when the view sits between two comments", () => {
    // Scrolled 5000 into the page, column top 4000px above the viewport → the dots at
    // 200 and 6000 land at -3800 (above the band) and 2000 (below it).
    const jump = computeRailJump([dot(200), dot(6000)], -4000, band, 5000);
    expect(jump.up).toBe(5000 + (-3800 - PARK));
    expect(jump.down).toBe(5000 + (2000 - PARK));
  });

  it("offers only the upward arrow past the last comment", () => {
    expect(computeRailJump([dot(200)], -4000, band, 5000)).toEqual({
      up: 5000 + (-3800 - PARK),
      down: null,
    });
  });

  it("offers only the downward arrow above the first comment", () => {
    expect(computeRailJump([dot(2000)], 0, band, 0)).toEqual({
      up: null,
      down: 2000 - PARK,
    });
  });

  it("picks the NEAREST comment in each direction", () => {
    // Dots land at -1800, -800 (above) and 1000, 2000 (below).
    const jump = computeRailJump(
      [dot(200), dot(1200), dot(3000), dot(4000)],
      -2000,
      band,
      2000,
    );
    expect(jump.up).toBe(2000 + (-800 - PARK)); // nearest above, not -1800
    expect(jump.down).toBe(2000 + (1000 - PARK)); // nearest below, not 2000
  });

  it("never asks for a negative scroll position", () => {
    // A comment just above the band while already at the top of the page.
    expect(computeRailJump([dot(100)], 0, band, 0).up).toBe(0);
  });

  it("treats the band edges as visible", () => {
    expect(computeRailJump([dot(148)], 0, band, 0)).toEqual({
      up: null,
      down: null,
    });
    expect(computeRailJump([dot(992)], 0, band, 0)).toEqual({
      up: null,
      down: null,
    });
  });

  it("has nothing to offer without comments", () => {
    expect(computeRailJump([], 0, band, 0)).toEqual({ up: null, down: null });
  });

  // The open rail draws tall cards, not dots — a card can straddle the whole viewport.
  it("counts a card overlapping the band as on screen, however tall", () => {
    // Card spans -400..+1400 in the viewport: neither edge is inside the band, but it
    // covers the entire screen. Treating it as off screen would offer arrows pointing
    // at a comment the reader is already staring at.
    expect(computeRailJump([{ top: 0, height: 1800 }], -400, band, 0)).toEqual({
      up: null,
      down: null,
    });
  });

  it("sends the reader past a tall card that ends above the band", () => {
    // Card spans -900..-100, entirely above the band.
    const jump = computeRailJump([{ top: 0, height: 800 }], -900, band, 2000);
    expect(jump.up).toBe(2000 + (-900 - PARK));
    expect(jump.down).toBeNull();
  });
});
