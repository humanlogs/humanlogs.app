import { describe, expect, it } from "vitest";
import {
  anchorColumns,
  anchorOf,
  isAnchorType,
  passageAnchor,
  sliceAnchor,
  sliceAnchorId,
} from "@/lib/comments/anchor";

/**
 * One table holds both kinds of note now, so the anchor is the only thing telling
 * them apart. Getting it wrong is quiet in the worst way: a slice note read as a
 * passage note points at a mark that does not exist, and a passage note read as a
 * slice note would appear under a question nobody asked it about.
 */

describe("anchor kinds", () => {
  it("knows the two it has", () => {
    expect(isAnchorType("passage")).toBe(true);
    expect(isAnchorType("slice")).toBe(true);
    expect(isAnchorType("elsewhere")).toBe(false);
  });
});

describe("a slice anchor", () => {
  it("is keyed on the canonical facet set", () => {
    const a = sliceAnchor("study1", ["code:cb1:violence", "speaker:renee"]);
    const b = sliceAnchor("study1", ["speaker:renee", "code:cb1:violence"]);
    expect(a.anchorId).toBe(b.anchorId);
    // ...and the stored facets are canonical too, so the containment test the
    // narrower-note rule runs never depends on how the question was built.
    expect(a.facets).toEqual(["code:cb1:violence", "speaker:renee"]);
  });

  it("deduplicates a facet that is both the group and the filter", () => {
    const anchor = sliceAnchor("study1", [
      "code:cb1:violence",
      "code:cb1:violence",
    ]);
    expect(anchor.facets).toEqual(["code:cb1:violence"]);
    expect(anchor.anchorId).toBe(sliceAnchorId(["code:cb1:violence"]));
  });

  it("treats the whole study as a real slice, not a missing one", () => {
    const anchor = sliceAnchor("study1", []);
    expect(anchor.anchorId).toBe("");
    expect(anchor.facets).toEqual([]);
  });

  it("hangs off the study and off no document", () => {
    const columns = anchorColumns(sliceAnchor("study1", ["document:doc1"]));
    expect(columns).toEqual({
      anchorType: "slice",
      anchorId: "document:doc1",
      transcriptionId: null,
      projectId: "study1",
      facets: ["document:doc1"],
    });
  });
});

describe("a passage anchor", () => {
  it("hangs off the document and off no study", () => {
    expect(anchorColumns(passageAnchor("doc1", "mark-7"))).toEqual({
      anchorType: "passage",
      anchorId: "mark-7",
      transcriptionId: "doc1",
      projectId: null,
      facets: null,
    });
  });
});

describe("reading a stored row back", () => {
  it("takes a row with no type as the original kind", () => {
    // Every comment written before there was a second kind of key.
    expect(anchorOf({ anchorId: "mark-7", transcriptionId: "doc1" })).toEqual(
      passageAnchor("doc1", "mark-7"),
    );
  });

  it("reads a slice row", () => {
    expect(
      anchorOf({
        anchorType: "slice",
        anchorId: "code:cb1:a",
        projectId: "study1",
        facets: ["code:cb1:a"],
      }),
    ).toEqual({
      type: "slice",
      projectId: "study1",
      anchorId: "code:cb1:a",
      facets: ["code:cb1:a"],
    });
  });

  it("skips a kind of key it does not understand", () => {
    // A row written by a newer build. Rendering it as a passage note would point
    // at a mark that is not there; null is the only honest answer.
    expect(
      anchorOf({ anchorType: "constellation", anchorId: "x", projectId: "s" }),
    ).toBeNull();
  });

  it("skips a row missing the thing its kind hangs off", () => {
    expect(anchorOf({ anchorType: "passage", anchorId: "m" })).toBeNull();
    expect(anchorOf({ anchorType: "slice", anchorId: "k" })).toBeNull();
  });

  it("survives facets stored as something that is not a list of strings", () => {
    expect(
      anchorOf({
        anchorType: "slice",
        anchorId: "k",
        projectId: "s",
        facets: [1, "code:cb1:a", null],
      }),
    ).toEqual({
      type: "slice",
      projectId: "s",
      anchorId: "k",
      facets: ["code:cb1:a"],
    });
  });
});
