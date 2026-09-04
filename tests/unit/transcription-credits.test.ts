import { describe, expect, it } from "vitest";
import { distributeCredits } from "@/lib/billing/transcription-credits";

/**
 * Credits are charged per upload *batch* — `ceil(total seconds / 60)` over
 * every file — but refunded per *transcription*, because files fail one at a
 * time. `distributeCredits` is the join between the two, and the property that
 * matters is conservation: the shares must add back up to exactly what the user
 * was billed. Anything else silently mints or burns credits on every failure.
 */
describe("distributeCredits", () => {
  it("gives a single file the whole charge", () => {
    expect(distributeCredits(38, [2280])).toEqual([38]);
  });

  it("splits proportionally to duration", () => {
    // 30 min + 10 min = 40 min billed, split 3:1.
    expect(distributeCredits(40, [1800, 600])).toEqual([30, 10]);
  });

  it("conserves the total when the split does not divide evenly", () => {
    // 3 x 50s = 150s -> ceil to 3 credits, which cannot be split three ways.
    const shares = distributeCredits(3, [50, 50, 50]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(3);
    expect(shares).toEqual([1, 1, 1]);
  });

  it("never loses or invents a credit, whatever the durations", () => {
    const cases: Array<[number, number[]]> = [
      [7, [61, 61, 61, 61, 61, 61, 61]],
      [1, [10, 20, 30]],
      [5, [1, 1, 1, 1, 1, 1, 1, 1, 1, 297]],
      [100, [3599, 1, 2, 1800]],
      [2, [0.5, 90]],
    ];

    for (const [total, durations] of cases) {
      const shares = distributeCredits(total, durations);
      expect(shares).toHaveLength(durations.length);
      expect(shares.reduce((a, b) => a + b, 0)).toBe(total);
      expect(shares.every((s) => s >= 0)).toBe(true);
    }
  });

  it("hands the rounding gain to the longest files", () => {
    // 2 credits over a long and a short file: the long one takes the extra.
    expect(distributeCredits(2, [3000, 60])).toEqual([2, 0]);
  });

  it("spreads evenly when no duration is known", () => {
    // The client sends 0 when it cannot probe the media.
    expect(distributeCredits(4, [0, 0, 0, 0])).toEqual([1, 1, 1, 1]);
    expect(distributeCredits(3, [0, 0]).reduce((a, b) => a + b, 0)).toBe(3);
  });

  it("charges nothing when billing is off or the batch is free", () => {
    expect(distributeCredits(0, [600, 600])).toEqual([0, 0]);
  });

  it("handles an empty batch", () => {
    expect(distributeCredits(0, [])).toEqual([]);
    expect(distributeCredits(5, [])).toEqual([]);
  });
});
