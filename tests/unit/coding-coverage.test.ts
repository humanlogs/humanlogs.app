import { describe, expect, it } from "vitest";
import {
  codedLengthOf,
  coveragePercent,
} from "@/lib/codebooks/coding-coverage";

/**
 * The figure is approximate by construction — both lengths are client-side
 * snapshots that stop being maintained the moment they are written. What has to
 * hold is the SHAPE of the answer: never below zero, never above a hundred, and
 * "I do not know" said as itself rather than as zero.
 */

describe("coveragePercent", () => {
  it("is the ratio, rounded", () => {
    expect(coveragePercent(250, 1000)).toBe(25);
    expect(coveragePercent(333, 1000)).toBe(33);
  });

  it("clamps at 100 — overlapping codings count the same sentence twice", () => {
    expect(coveragePercent(3000, 1000)).toBe(100);
  });

  it("clamps at 0 rather than going negative on a nonsense length", () => {
    expect(coveragePercent(-50, 1000)).toBe(0);
  });

  it("says nothing rather than zero when there is no denominator", () => {
    // A document saved before the column existed: 0% would be a claim about the
    // corpus, and this is a claim about our own records.
    expect(coveragePercent(500, null)).toBeNull();
    expect(coveragePercent(500, undefined)).toBeNull();
    expect(coveragePercent(500, 0)).toBeNull();
  });

  it("is zero when nothing is coded but the document has a length", () => {
    expect(coveragePercent(0, 1000)).toBe(0);
  });

  it("survives a non-finite numerator", () => {
    expect(coveragePercent(Number.NaN, 1000)).toBe(0);
    expect(coveragePercent(Number.POSITIVE_INFINITY, 1000)).toBe(100);
  });
});

describe("codedLengthOf", () => {
  const codings = [
    { codebookId: "cb1", textLength: 100 },
    { codebookId: "cb1", textLength: 50 },
    { codebookId: "cb2", textLength: 900 },
  ];

  it("sums only the grille asked for", () => {
    expect(codedLengthOf(codings, "cb1")).toBe(150);
    expect(codedLengthOf(codings, "cb2")).toBe(900);
  });

  it("is zero for a grille nothing was coded through", () => {
    expect(codedLengthOf(codings, "cb3")).toBe(0);
  });

  it("treats a coding written before the column existed as zero", () => {
    expect(codedLengthOf([{ codebookId: "cb1" }], "cb1")).toBe(0);
  });
});
