import { describe, expect, it } from "vitest";
import type { DecryptedCodebook } from "@/lib/codebooks/codebook";
import {
  buildCodingOptions,
  codeColorVar,
  codingBackground,
  codingsInScope,
  optionForSequence,
  parseCodingInput,
  sanitizeCodings,
  sequenceHasContinuation,
  verbatimCodebooks,
  type CodingDTO,
} from "@/lib/codebooks/coding";

/**
 * The rules the coding phase is driven by: which letter reaches which code, which
 * colour a passage is painted, and whose codings are on screen.
 *
 * These are pure functions on purpose — the keyboard path is the one researchers
 * actually use, and "press A then B" has to mean the same thing in the menu, in the
 * legend and in the key handler.
 */

const codebook = (
  id: string,
  name: string,
  codes: DecryptedCodebook["codes"],
): DecryptedCodebook =>
  ({
    id,
    name,
    codes,
    allStudies: true,
    target: "verbatim",
    preset: null,
    studyIds: [],
    createdAt: "",
    updatedAt: "",
  }) as DecryptedCodebook;

const TREE = [
  codebook("cb1", "Themes", [
    {
      id: "emotion",
      label: "Emotion",
      color: "red",
      children: [
        { id: "joy", label: "Joy" },
        { id: "fear", label: "Fear" },
      ],
    },
    { id: "work", label: "Work", color: "blue" },
  ]),
  codebook("cb2", "Method", [{ id: "quote", label: "Quotable", color: "teal" }]),
];

describe("coding options", () => {
  it("letters the codes of the chosen prism from A", () => {
    // The editor codes through ONE codebook at a time, so its codes own the whole
    // alphabet: the researcher types "A" and there is exactly one answer.
    const options = buildCodingOptions([TREE[0]]);
    expect(options.map((o) => [o.code.id, o.sequence])).toEqual([
      ["emotion", "A"],
      ["work", "B"],
    ]);
  });

  it("never lets two codes answer to the same letter", () => {
    // Should more than one codebook ever be shown at once, the letters still run
    // across the whole list rather than restarting per codebook.
    const options = buildCodingOptions(TREE);
    expect(options.map((o) => o.sequence)).toEqual(["A", "B", "C"]);
  });

  it("restarts letters inside a code, so AB is its second sub-code", () => {
    const options = buildCodingOptions(TREE);
    expect(optionForSequence(options, "AB")?.code.id).toBe("fear");
    expect(optionForSequence(options, "AA")?.code.id).toBe("joy");
    expect(optionForSequence(options, "AC")).toBeNull();
  });

  it("knows when a sequence can still grow", () => {
    const options = buildCodingOptions(TREE);
    // "A" has sub-codes: applying it on the first keystroke would fight the second.
    expect(sequenceHasContinuation(options, "A")).toBe(true);
    expect(sequenceHasContinuation(options, "B")).toBe(false);
    expect(sequenceHasContinuation(options, "AB")).toBe(false);
  });

  it("gives sub-codes their parent's colour", () => {
    // Sub-codes carry no colour of their own yet; a passage coded with a sub-theme
    // still has to read as belonging to its theme.
    const options = buildCodingOptions(TREE);
    expect(options[0].children.map((c) => c.color)).toEqual(["red", "red"]);
  });

  it("keeps only verbatim codebooks", () => {
    const speaker = { ...codebook("cb3", "People", []), target: "speaker" };
    expect(verbatimCodebooks([...TREE, speaker as never]).map((c) => c.id)).toEqual(
      ["cb1", "cb2"],
    );
  });
});

describe("coding colours", () => {
  it("maps a palette key onto the Tailwind CSS variable", () => {
    expect(codeColorVar("green")).toBe("var(--color-emerald-500)");
    expect(codeColorVar(null)).toBe("var(--color-slate-400)");
  });

  it("washes one colour and hatches several", () => {
    const one = codingBackground(["red"]);
    expect(one).toContain("color-mix");
    expect(one).not.toContain("repeating-linear-gradient");

    // Blending two codes would produce a third colour matching neither legend dot.
    const two = codingBackground(["red", "blue"]);
    expect(two).toContain("repeating-linear-gradient");
    expect(two).toContain("var(--color-red-500)");
    expect(two).toContain("var(--color-blue-500)");
  });

  it("treats the same colour twice as one", () => {
    expect(codingBackground(["red", "red"])).toBe(codingBackground(["red"]));
  });

  it("paints nothing when there is nothing to paint", () => {
    expect(codingBackground([])).toBe("transparent");
  });
});

describe("coding scope", () => {
  const codings: CodingDTO[] = [
    {
      id: "1",
      userId: "me",
      author: null,
      codebookId: "cb1",
      codeId: "emotion",
      createdAt: "",
    },
    {
      id: "2",
      userId: "them",
      author: null,
      codebookId: "cb1",
      codeId: "work",
      createdAt: "",
    },
  ];

  it("shows only my own pass by default", () => {
    expect(codingsInScope(codings, "mine", "me").map((c) => c.id)).toEqual(["1"]);
    expect(codingsInScope(codings, "everyone", "me")).toHaveLength(2);
  });

  it("shows nothing rather than everything when the user is unknown", () => {
    expect(codingsInScope(codings, "mine", undefined)).toEqual([]);
  });

  it("hides codings whose code was deleted", () => {
    // Deleting a code leaves its codings behind on purpose; filtering is what makes
    // them invisible.
    expect(
      sanitizeCodings(codings, [
        { id: "cb1", codes: [{ id: "emotion", label: "Emotion" }] },
      ]).map((c) => c.id),
    ).toEqual(["1"]);
  });
});

describe("coding input validation", () => {
  const allowed = new Set(["cb1"]);

  it("accepts a well-formed coding", () => {
    expect(
      parseCodingInput(
        { id: "x", codebookId: "cb1", codeId: "emotion" },
        allowed,
      ),
    ).toEqual({ data: { id: "x", codebookId: "cb1", codeId: "emotion" } });
  });

  it("rejects a codebook the caller does not own", () => {
    expect(
      parseCodingInput(
        { id: "x", codebookId: "cb9", codeId: "emotion" },
        allowed,
      ),
    ).toEqual({ error: "Unknown codebook" });
  });

  it("requires the client-generated id", () => {
    // The mark carries it before the row exists, so a missing id would anchor a
    // highlight on nothing.
    expect(
      parseCodingInput({ codebookId: "cb1", codeId: "emotion" }, allowed),
    ).toEqual({ error: "id is required" });
  });
});
