import { describe, expect, it } from "vitest";
import {
  codebooksInScopeForProject,
  flattenCodes,
  groupableCodebooks,
  parseCodebookInput,
  parseCodeRefs,
  parseParticipantCodeRefs,
  participantCodebooks,
  sanitizeCodeRefs,
  sanitizeParticipantCodeRefs,
  validateCodeRefs,
  validateParticipantCodeRefs,
} from "@/lib/codebooks/codebook";

/**
 * Scoping and input validation for codebooks. `validateCodeRefs` is the guard
 * between an arbitrary request body and what gets written on a document, and
 * `sanitizeCodeRefs` is what keeps deleted codes from surfacing — deletions
 * deliberately leave stale refs behind.
 */

const cb = (
  id: string,
  overrides: Partial<{ allStudies: boolean; studyIds: string[] }> = {},
) => ({
  id,
  allStudies: false,
  studyIds: [],
  ...overrides,
});

describe("codebooksInScopeForProject", () => {
  const codebooks = [
    cb("all", { allStudies: true }),
    cb("p1", { studyIds: ["p1"] }),
    cb("multi", { studyIds: ["p1", "p2"] }),
    cb("p2", { studyIds: ["p2"] }),
  ];

  it("includes the all-studies ones and those linked to the study", () => {
    expect(
      codebooksInScopeForProject(codebooks, "p1").map((c) => c.id),
    ).toEqual(["all", "p1", "multi"]);
  });

  it("keeps only all-studies codebooks for a document without a study", () => {
    expect(codebooksInScopeForProject(codebooks, null).map((c) => c.id)).toEqual(
      ["all"],
    );
    expect(
      codebooksInScopeForProject(codebooks, undefined).map((c) => c.id),
    ).toEqual(["all"]);
  });
});

describe("groupableCodebooks", () => {
  it("offers only the codebooks that cover every study", () => {
    const codebooks = [
      cb("all", { allStudies: true }),
      cb("scoped", { studyIds: ["p1"] }),
    ];
    expect(groupableCodebooks(codebooks).map((c) => c.id)).toEqual(["all"]);
  });

  it("keeps document and participant codebooks, drops the finer grains", () => {
    const codebooks = [
      { ...cb("doc", { allStudies: true }), target: "document" as const },
      {
        ...cb("people", { allStudies: true }),
        target: "participant" as const,
      },
      { ...cb("phrase", { allStudies: true }), target: "sentence" as const },
      { ...cb("mot", { allStudies: true }), target: "word" as const },
    ];
    expect(groupableCodebooks(codebooks).map((c) => c.id)).toEqual([
      "doc",
      "people",
    ]);
  });
});

describe("participantCodebooks", () => {
  it("keeps the codebooks that code people rather than text", () => {
    const codebooks = [
      { id: "a", target: "participant" as const },
      { id: "b", target: "document" as const },
      { id: "c" },
    ];
    expect(participantCodebooks(codebooks).map((c) => c.id)).toEqual(["a"]);
  });
});

describe("validateCodeRefs", () => {
  const allowed = new Set(["cb1", "cb2"]);

  it("accepts well-formed refs to owned codebooks", () => {
    expect(
      validateCodeRefs([{ codebookId: "cb1", codeId: "c1" }], allowed),
    ).toEqual({ codes: [{ codebookId: "cb1", codeId: "c1" }] });
  });

  it("treats null as clearing the codes", () => {
    expect(validateCodeRefs(null, allowed)).toEqual({ codes: [] });
  });

  it("rejects a codebook the caller may not use", () => {
    expect(
      validateCodeRefs([{ codebookId: "other", codeId: "c1" }], allowed),
    ).toEqual({ error: "Unknown codebook" });
  });

  it("rejects malformed entries instead of dropping them", () => {
    expect(validateCodeRefs([{ codebookId: "cb1" }], allowed)).toHaveProperty(
      "error",
    );
    expect(validateCodeRefs("nope", allowed)).toHaveProperty("error");
  });

  it("deduplicates repeated refs", () => {
    const result = validateCodeRefs(
      [
        { codebookId: "cb1", codeId: "c1" },
        { codebookId: "cb1", codeId: "c1" },
        { codebookId: "cb2", codeId: "c1" },
      ],
      allowed,
    );
    expect(result).toEqual({
      codes: [
        { codebookId: "cb1", codeId: "c1" },
        { codebookId: "cb2", codeId: "c1" },
      ],
    });
  });
});

describe("validateParticipantCodeRefs", () => {
  const allowed = new Set(["cb1"]);

  it("accepts a code pinned on a participant", () => {
    expect(
      validateParticipantCodeRefs(
        [{ participantId: "speaker_0", codebookId: "cb1", codeId: "c1" }],
        allowed,
      ),
    ).toEqual({
      participantCodes: [
        { participantId: "speaker_0", codebookId: "cb1", codeId: "c1" },
      ],
    });
  });

  it("treats null as clearing every participant's codes", () => {
    expect(validateParticipantCodeRefs(null, allowed)).toEqual({
      participantCodes: [],
    });
  });

  it("rejects a ref without a participant", () => {
    expect(
      validateParticipantCodeRefs(
        [{ codebookId: "cb1", codeId: "c1" }],
        allowed,
      ),
    ).toHaveProperty("error");
    expect(
      validateParticipantCodeRefs(
        [{ participantId: "", codebookId: "cb1", codeId: "c1" }],
        allowed,
      ),
    ).toHaveProperty("error");
  });

  it("rejects a codebook the caller may not use", () => {
    expect(
      validateParticipantCodeRefs(
        [{ participantId: "speaker_0", codebookId: "other", codeId: "c1" }],
        allowed,
      ),
    ).toEqual({ error: "Unknown codebook" });
  });

  it("keeps the same code on two participants but deduplicates one", () => {
    expect(
      validateParticipantCodeRefs(
        [
          { participantId: "speaker_0", codebookId: "cb1", codeId: "c1" },
          { participantId: "speaker_1", codebookId: "cb1", codeId: "c1" },
          { participantId: "speaker_0", codebookId: "cb1", codeId: "c1" },
        ],
        allowed,
      ),
    ).toEqual({
      participantCodes: [
        { participantId: "speaker_0", codebookId: "cb1", codeId: "c1" },
        { participantId: "speaker_1", codebookId: "cb1", codeId: "c1" },
      ],
    });
  });
});

describe("parseParticipantCodeRefs", () => {
  it("keeps only well-formed entries from database JSON", () => {
    expect(
      parseParticipantCodeRefs([
        { participantId: "speaker_0", codebookId: "cb1", codeId: "c1" },
        { codebookId: "cb1", codeId: "c1" },
        { participantId: 1, codebookId: "cb1", codeId: "c1" },
        null,
      ]),
    ).toEqual([
      { participantId: "speaker_0", codebookId: "cb1", codeId: "c1" },
    ]);
    expect(parseParticipantCodeRefs(null)).toEqual([]);
  });
});

describe("sanitizeParticipantCodeRefs", () => {
  const codebooks = [{ id: "cb1", codes: [{ id: "c1", label: "One" }] }];

  it("drops refs whose codebook or code is gone, whoever carries them", () => {
    expect(
      sanitizeParticipantCodeRefs(
        [
          { participantId: "speaker_0", codebookId: "cb1", codeId: "c1" },
          { participantId: "speaker_0", codebookId: "cb1", codeId: "gone" },
          { participantId: "speaker_1", codebookId: "gone", codeId: "c1" },
        ],
        codebooks,
      ),
    ).toEqual([
      { participantId: "speaker_0", codebookId: "cb1", codeId: "c1" },
    ]);
  });

  it("keeps a ref to a participant the transcript no longer shows", () => {
    // The speaker may come back (a merge, a rename round-trip); losing the
    // coding would lose work the researcher cannot recover.
    expect(
      sanitizeParticipantCodeRefs(
        [{ participantId: "speaker_9", codebookId: "cb1", codeId: "c1" }],
        codebooks,
      ),
    ).toEqual([
      { participantId: "speaker_9", codebookId: "cb1", codeId: "c1" },
    ]);
  });
});

describe("flattenCodes", () => {
  const codes = [
    {
      id: "a",
      label: "A",
      children: [
        { id: "a1", label: "A1" },
        { id: "a2", label: "A2", children: [{ id: "a2x", label: "A2x" }] },
      ],
    },
    { id: "b", label: "B" },
  ];

  it("walks depth-first, a parent immediately followed by its descendants", () => {
    expect(flattenCodes(codes).map(({ code }) => code.id)).toEqual([
      "a",
      "a1",
      "a2",
      "a2x",
      "b",
    ]);
  });

  it("records the ancestor path and the depth", () => {
    const deep = flattenCodes(codes).find(({ code }) => code.id === "a2x")!;
    expect(deep.path).toEqual(["A", "A2", "A2x"]);
    expect(deep.depth).toBe(2);
  });

  it("handles missing values", () => {
    expect(flattenCodes(undefined)).toEqual([]);
    expect(flattenCodes([])).toEqual([]);
  });
});

describe("sanitizeCodeRefs", () => {
  const codebooks = [
    {
      id: "cb1",
      codes: [
        {
          id: "c1",
          label: "One",
          children: [{ id: "c1a", label: "One, refined" }],
        },
      ],
    },
  ];

  it("accepts a ref to a sub-code", () => {
    expect(
      sanitizeCodeRefs([{ codebookId: "cb1", codeId: "c1a" }], codebooks),
    ).toEqual([{ codebookId: "cb1", codeId: "c1a" }]);
  });

  it("drops refs whose codebook or code is gone", () => {
    expect(
      sanitizeCodeRefs(
        [
          { codebookId: "cb1", codeId: "c1" },
          { codebookId: "cb1", codeId: "deleted" },
          { codebookId: "deleted", codeId: "c1" },
        ],
        codebooks,
      ),
    ).toEqual([{ codebookId: "cb1", codeId: "c1" }]);
  });

  it("handles missing values", () => {
    expect(sanitizeCodeRefs(null, codebooks)).toEqual([]);
    expect(sanitizeCodeRefs(undefined, codebooks)).toEqual([]);
  });
});

describe("parseCodeRefs", () => {
  it("keeps only well-formed entries from database JSON", () => {
    expect(
      parseCodeRefs([
        { codebookId: "cb1", codeId: "c1" },
        { codebookId: 42, codeId: "c1" },
        null,
        "nope",
      ]),
    ).toEqual([{ codebookId: "cb1", codeId: "c1" }]);
    expect(parseCodeRefs(null)).toEqual([]);
  });
});

describe("parseCodebookInput", () => {
  it("requires a reachable scope on creation", () => {
    expect(
      parseCodebookInput(
        { content: { name: "x", codes: [] }, allStudies: false, studyIds: [] },
        { requireContent: true },
      ),
    ).toHaveProperty("error");

    expect(
      parseCodebookInput(
        { content: { name: "x", codes: [] }, allStudies: true },
        { requireContent: true },
      ),
    ).toHaveProperty("data");
  });

  it("lets a patch leave the scope untouched", () => {
    expect(
      parseCodebookInput({ target: "sentence" }, { requireContent: false }),
    ).toEqual({ data: { target: "sentence" } });
  });

  it("refuses an empty study list when the codebook is not all-studies", () => {
    expect(
      parseCodebookInput(
        { allStudies: false, studyIds: [] },
        { requireContent: false },
      ),
    ).toHaveProperty("error");
  });

  it("rejects unknown targets and malformed fields", () => {
    expect(
      parseCodebookInput({ target: "paragraph" }, { requireContent: false }),
    ).toHaveProperty("error");
    expect(
      parseCodebookInput({ studyIds: [1] }, { requireContent: false }),
    ).toHaveProperty("error");
    expect(
      parseCodebookInput({ content: "text" }, { requireContent: true }),
    ).toHaveProperty("error");
  });

  it("deduplicates the study list", () => {
    const result = parseCodebookInput(
      { studyIds: ["p1", "p1", "p2"] },
      { requireContent: false },
    );
    expect(result).toEqual({ data: { studyIds: ["p1", "p2"] } });
  });
});
