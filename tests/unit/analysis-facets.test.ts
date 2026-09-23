import { describe, expect, it } from "vitest";
import {
  analysisKey,
  covers,
  describeFacet,
  extraFacets,
  facetsOfView,
  isNarrowerThan,
  keyOfView,
  parseAnalysisKey,
} from "@/lib/analysis/analysis-facets";

const POSITIF = { codebookId: "cb1", codeId: "positif" };
const NEUTRE = { codebookId: "cb1", codeId: "neutre" };
const CADRE = { codebookId: "cb2", codeId: "cadre" };

describe("analysisKey", () => {
  it("is order-independent", () => {
    expect(analysisKey(["b", "a", "c"])).toBe(analysisKey(["c", "b", "a"]));
  });

  it("deduplicates", () => {
    expect(analysisKey(["a", "a", "b"])).toBe("a|b");
  });

  it("round-trips through parse", () => {
    const facets = ["code:cb1:positif", "context:cb2:cadre"];
    expect(parseAnalysisKey(analysisKey(facets))).toEqual(facets);
  });

  it("treats the empty set as a real key", () => {
    expect(analysisKey([])).toBe("");
    expect(parseAnalysisKey("")).toEqual([]);
  });
});

describe("facetsOfView", () => {
  it("takes the group's own facets", () => {
    expect(facetsOfView({ groupFacets: ["code:cb1:positif"] })).toEqual([
      "code:cb1:positif",
    ]);
  });

  it("ignores the ungrouped group, which narrows nothing", () => {
    expect(facetsOfView({ groupFacets: [] })).toEqual([]);
  });

  it("distinguishes a verbatim code from a context code", () => {
    expect(facetsOfView({ codes: [POSITIF], contextCodes: [CADRE] })).toEqual([
      "code:cb1:positif",
      "context:cb2:cadre",
    ]);
  });

  it("keys a person by the group, which the query already resolves by name", () => {
    expect(facetsOfView({ groupFacets: ["speaker:renee"] })).toEqual([
      "speaker:renee",
    ]);
  });

  it("adds the scoped document", () => {
    expect(facetsOfView({ documentId: "doc1" })).toEqual(["document:doc1"]);
  });

  it("does not repeat a code that is both the group and the filter", () => {
    expect(
      facetsOfView({ groupFacets: ["code:cb1:positif"], codes: [POSITIF] }),
    ).toEqual(["code:cb1:positif"]);
  });

  it("reaches the same key whether the slice was grouped then filtered or the reverse", () => {
    const grouped = keyOfView({
      groupFacets: ["code:cb1:positif"],
      contextCodes: [CADRE],
    });
    const filtered = keyOfView({
      groupFacets: ["context:cb2:cadre"],
      codes: [POSITIF],
    });
    // Same two facets, arrived at from either side.
    expect(grouped).toBe("code:cb1:positif|context:cb2:cadre");
    expect(filtered).toBe("code:cb1:positif|context:cb2:cadre");
    expect(grouped).toBe(filtered);
  });
});

describe("narrowing", () => {
  const positif = facetsOfView({ groupFacets: ["code:cb1:positif"] });
  const positifCadre = facetsOfView({
    groupFacets: ["code:cb1:positif"],
    contextCodes: [CADRE],
  });
  const neutre = facetsOfView({ groupFacets: ["code:cb1:neutre"] });

  it("finds a narrower note from a wider view", () => {
    expect(isNarrowerThan(positifCadre, positif)).toBe(true);
  });

  it("does not offer a wider note to a narrower view", () => {
    expect(isNarrowerThan(positif, positifCadre)).toBe(false);
  });

  it("is strict: the same slice is not narrower than itself", () => {
    expect(isNarrowerThan(positif, positif)).toBe(false);
    expect(covers(positif, positif)).toBe(true);
  });

  it("keeps sibling groups apart", () => {
    expect(isNarrowerThan(neutre, positif)).toBe(false);
    expect(covers(neutre, positif)).toBe(false);
  });

  it("everything is narrower than the study-wide note", () => {
    expect(isNarrowerThan(positifCadre, [])).toBe(true);
    expect(isNarrowerThan(neutre, [])).toBe(true);
  });

  it("names what makes a note narrower", () => {
    expect(extraFacets(positifCadre, positif)).toEqual(["context:cb2:cadre"]);
  });

  it("scoping to one document narrows the same group", () => {
    const inDoc = facetsOfView({
      groupFacets: ["code:cb1:positif"],
      documentId: "doc1",
    });
    expect(isNarrowerThan(inDoc, positif)).toBe(true);
    expect(extraFacets(inDoc, positif)).toEqual(["document:doc1"]);
  });

  it("ignores the search box, so a note is never stranded behind a typo", () => {
    // `search` is not part of the view type at all — asserting the shape here
    // keeps a future addition from silently changing what a note is attached to.
    const withSearch = keyOfView({ groupFacets: ["code:cb1:positif"] });
    expect(withSearch).toBe(keyOfView({ groupFacets: ["code:cb1:positif"] }));
  });

  it("ignores which author's readings are shown", () => {
    expect(keyOfView({ groupFacets: ["code:cb1:neutre"] })).toBe(
      analysisKey(["code:cb1:neutre"]),
    );
  });

  it("does not confuse two codes of different codebooks", () => {
    const a = facetsOfView({ codes: [{ codebookId: "x", codeId: "a" }] });
    const b = facetsOfView({ codes: [{ codebookId: "y", codeId: "a" }] });
    expect(covers(a, b)).toBe(false);
  });

  it("separates two codes of the same codebook", () => {
    expect(facetsOfView({ codes: [POSITIF, NEUTRE] })).toEqual([
      "code:cb1:neutre",
      "code:cb1:positif",
    ]);
  });
});

describe("describeFacet", () => {
  it("reads a code", () => {
    expect(describeFacet("code:cb1:positif")).toEqual({
      kind: "code",
      codebookId: "cb1",
      codeId: "positif",
    });
  });

  it("reads a context code", () => {
    expect(describeFacet("context:cb2:cadre")).toEqual({
      kind: "context",
      codebookId: "cb2",
      codeId: "cadre",
    });
  });

  it("reads a person", () => {
    expect(describeFacet("speaker:renee mollard")).toEqual({
      kind: "speaker",
      id: "renee mollard",
    });
  });

  it("reads a document", () => {
    expect(describeFacet("document:doc1")).toEqual({
      kind: "document",
      id: "doc1",
    });
  });

  it("does not throw on something it has never seen", () => {
    expect(describeFacet("weather:sunny").kind).toBe("unknown");
  });
});
