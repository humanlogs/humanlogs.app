import { describe, expect, it } from "vitest";
import {
  groupKeyOf,
  placementsOf,
  ruleId,
  rulesFromGroupBy,
  sameRule,
  type GroupRule,
} from "@/lib/local/group-rules";
import type { PhraseCodeRow } from "@/lib/local/phrase-index";

/**
 * Grouping is a CHAIN now, and the chain is what an analysis is attached to. A
 * mistake here is silent in both directions: a crossing that splits into two
 * groups strands a note in one of them, and a crossing that merges two slices
 * puts a note under material it was not written about.
 */

function link(
  over: Partial<PhraseCodeRow> & { codeId: string },
): PhraseCodeRow {
  return {
    phraseId: "p1",
    codingId: `c-${over.codeId}`,
    documentId: "doc1",
    projectId: "study1",
    speakerId: "speaker_0",
    codebookId: "cb1",
    userId: "u1",
    offset: 0,
    studyKey: "study1",
    ...over,
  } as PhraseCodeRow;
}

const VIOLENCE = link({ codeId: "violence" });
const INSTITUTION = link({ codeId: "institution" });

describe("ruleId", () => {
  it("separates a codebook-scoped code rule from the open one", () => {
    expect(ruleId({ kind: "code" })).toBe("code");
    expect(ruleId({ kind: "code", codebookId: "cb1" })).toBe("code:cb1");
  });

  it("separates the two things a codebook can be grouped on", () => {
    expect(
      sameRule(
        { kind: "code", codebookId: "cb1" },
        { kind: "context", codebookId: "cb1" },
      ),
    ).toBe(false);
  });
});

describe("rulesFromGroupBy", () => {
  it("maps the single axes", () => {
    expect(rulesFromGroupBy("code")).toEqual([{ kind: "code" }]);
    expect(rulesFromGroupBy("speaker")).toEqual([{ kind: "speaker" }]);
    expect(rulesFromGroupBy("document")).toEqual([{ kind: "document" }]);
  });

  it("treats ungrouped as no rules at all", () => {
    expect(rulesFromGroupBy("none")).toEqual([]);
  });
});

describe("placementsOf", () => {
  it("puts an ungrouped phrase in one nameless group", () => {
    const [placement] = placementsOf([], [VIOLENCE]);
    expect(placement.facets).toEqual([]);
    expect(groupKeyOf(placement.facets)).toBe("");
  });

  it("puts a phrase under every code it carries", () => {
    const facets = placementsOf(
      [{ kind: "code" }],
      [VIOLENCE, INSTITUTION],
    ).map((p) => groupKeyOf(p.facets));
    expect(facets).toEqual(["code:cb1:violence", "code:cb1:institution"]);
  });

  it("counts a code applied by two authors once", () => {
    const placements = placementsOf(
      [{ kind: "code" }],
      [VIOLENCE, link({ codeId: "violence", userId: "u2" })],
    );
    expect(placements).toHaveLength(1);
  });

  it("crosses two rules", () => {
    const keys = placementsOf(
      [{ kind: "speaker" }, { kind: "code" }],
      [VIOLENCE, INSTITUTION],
      { speakerPersons: { "doc1:speaker_0": "renee" } },
    ).map((p) => groupKeyOf(p.facets));
    expect(keys).toEqual([
      "code:cb1:violence|speaker:renee",
      "code:cb1:institution|speaker:renee",
    ]);
  });

  it("gives a crossing ONE identity whichever order the rules are in", () => {
    const context = { speakerPersons: { "doc1:speaker_0": "renee" } };
    const a = placementsOf(
      [{ kind: "speaker" }, { kind: "code" }],
      [VIOLENCE],
      context,
    );
    const b = placementsOf(
      [{ kind: "code" }, { kind: "speaker" }],
      [VIOLENCE],
      context,
    );
    expect(groupKeyOf(a[0].facets)).toBe(groupKeyOf(b[0].facets));
    // ...and still reads in the order the rules were added.
    expect(a[0].facets).toEqual(["speaker:renee", "code:cb1:violence"]);
    expect(b[0].facets).toEqual(["code:cb1:violence", "speaker:renee"]);
  });

  it("links a person across interviews, so Renée twice is one group", () => {
    const context = {
      speakerPersons: { "doc1:speaker_0": "renee", "doc2:speaker_3": "renee" },
    };
    const first = placementsOf([{ kind: "speaker" }], [VIOLENCE], context);
    const second = placementsOf(
      [{ kind: "speaker" }],
      [
        link({
          codeId: "violence",
          documentId: "doc2",
          speakerId: "speaker_3",
        }),
      ],
      context,
    );
    expect(groupKeyOf(first[0].facets)).toBe(groupKeyOf(second[0].facets));
  });

  it("falls back to the (document, speaker) pair when nobody is named", () => {
    const [placement] = placementsOf([{ kind: "speaker" }], [VIOLENCE]);
    expect(placement.facets).toEqual(["speaker:doc1:speaker_0"]);
  });

  it("keeps a code rule to its own codebook", () => {
    const keys = placementsOf(
      [{ kind: "code", codebookId: "cb1" }],
      [VIOLENCE, link({ codeId: "cadre", codebookId: "cb2" })],
    ).map((p) => groupKeyOf(p.facets));
    expect(keys).toEqual(["code:cb1:violence"]);
  });

  it("gives a passage no code of that codebook covers a row of its own", () => {
    const keys = placementsOf(
      [{ kind: "code", codebookId: "cb2" }],
      [VIOLENCE],
    ).map((p) => groupKeyOf(p.facets));
    // Dropped, it would quietly shrink the corpus; "what this grille misses" is
    // one of the things a grille is read for.
    expect(keys).toEqual(["nocode:cb2"]);
  });

  it("reads a context rule off the PERSON, not off the passage", () => {
    const keys = placementsOf(
      [{ kind: "context", codebookId: "roles" }],
      [VIOLENCE],
      {
        speakerPersons: { "doc1:speaker_0": "renee" },
        contextByPerson: { renee: ["roles:cadre"] },
      },
    ).map((p) => groupKeyOf(p.facets));
    expect(keys).toEqual(["context:roles:cadre"]);
  });

  it("reads a context rule off the document too", () => {
    const keys = placementsOf(
      [{ kind: "context", codebookId: "site" }],
      [VIOLENCE],
      {
        contextByDocument: { doc1: ["site:hopital"] },
      },
    ).map((p) => groupKeyOf(p.facets));
    expect(keys).toEqual(["context:site:hopital"]);
  });

  it("ignores context codes from another codebook", () => {
    const keys = placementsOf(
      [{ kind: "context", codebookId: "roles" }],
      [VIOLENCE],
      {
        contextByDocument: { doc1: ["site:hopital"] },
      },
    ).map((p) => groupKeyOf(p.facets));
    expect(keys).toEqual(["nocode:roles"]);
  });

  it("is the crossing the user asked for: the cadres, code by code", () => {
    const keys = placementsOf(
      [{ kind: "context", codebookId: "roles" }, { kind: "code" }],
      [VIOLENCE, INSTITUTION],
      {
        speakerPersons: { "doc1:speaker_0": "renee" },
        contextByPerson: { renee: ["roles:cadre"] },
      },
    ).map((p) => groupKeyOf(p.facets));
    expect(keys).toEqual([
      "code:cb1:violence|context:roles:cadre",
      "code:cb1:institution|context:roles:cadre",
    ]);
  });

  it("caps the explosion rather than running forever", () => {
    const many: PhraseCodeRow[] = Array.from({ length: 40 }, (_, i) =>
      link({ codeId: `c${i}` }),
    );
    const rules: GroupRule[] = [{ kind: "code" }, { kind: "code" }];
    expect(placementsOf(rules, many).length).toBeLessThanOrEqual(64);
  });

  it("places nothing when a phrase has no surviving link", () => {
    expect(placementsOf([{ kind: "code" }], [])).toEqual([]);
  });
});

describe("groupKeyOf", () => {
  it("is order- and duplicate-insensitive", () => {
    expect(groupKeyOf(["b", "a", "a"])).toBe(groupKeyOf(["a", "b"]));
  });
});
