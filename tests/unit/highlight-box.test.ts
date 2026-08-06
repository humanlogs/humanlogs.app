import { describe, expect, it } from "vitest";
import { mergeRectsByLine } from "@/components/transcriptions/editor/text/components/highlight-box";

/**
 * One box per line of a selection.
 *
 * `Range.getClientRects()` reports a rect per text-node fragment, and a coded passage
 * is split into as many fragments as it has distinct sets of coding marks. Outlining
 * each of them turns one selected sentence into a row of little boxes — precisely the
 * "three signals at once" the shared highlight style exists to avoid.
 *
 * `DOMRect` is not implemented in the Node test environment, so it is stubbed with the
 * three properties this function reads back (`right`, `bottom`, `height`).
 */

class FakeDOMRect {
  constructor(
    public x: number,
    public y: number,
    public width: number,
    public height: number,
  ) {}
  get left() {
    return this.x;
  }
  get top() {
    return this.y;
  }
  get right() {
    return this.x + this.width;
  }
  get bottom() {
    return this.y + this.height;
  }
}

(globalThis as any).DOMRect = FakeDOMRect;

const rect = (x: number, y: number, w: number, h = 20) =>
  new FakeDOMRect(x, y, w, h) as unknown as DOMRect;

const asTuples = (rects: DOMRect[]) =>
  rects.map((r) => [r.left, r.top, r.width, r.height]);

describe("mergeRectsByLine", () => {
  it("unions the fragments of one line into a single box", () => {
    // What a coded sentence looks like: three runs, one line.
    const merged = mergeRectsByLine([
      rect(10, 100, 40),
      rect(50, 100, 30),
      rect(80, 100, 25),
    ]);
    expect(asTuples(merged)).toEqual([[10, 100, 95, 20]]);
  });

  it("keeps one box per line for a selection that wraps", () => {
    const merged = mergeRectsByLine([
      rect(10, 100, 40),
      rect(50, 100, 30),
      rect(0, 130, 60),
    ]);
    expect(asTuples(merged)).toEqual([
      [10, 100, 70, 20],
      [0, 130, 60, 20],
    ]);
  });

  it("merges a taller run into the line it sits on", () => {
    // A bigger glyph or a nested span makes a rect taller without starting a line.
    const merged = mergeRectsByLine([rect(10, 100, 40), rect(50, 96, 30, 28)]);
    expect(merged).toHaveLength(1);
    expect(merged[0].height).toBe(28);
  });

  it("drops empty rects rather than drawing hairlines", () => {
    expect(mergeRectsByLine([rect(10, 100, 0), rect(10, 100, 0, 0)])).toEqual(
      [],
    );
  });

  it("orders the lines top to bottom whatever order they arrive in", () => {
    const merged = mergeRectsByLine([rect(0, 130, 60), rect(10, 100, 40)]);
    expect(merged.map((r) => r.top)).toEqual([100, 130]);
  });
});
