import { describe, expect, it } from "vitest";
import {
  codebookIdFromGroupBy,
  groupDocuments,
  sortDocuments,
  timeBucketFor,
  type GroupableDocument,
} from "@/lib/documents/grouping";

/**
 * The sidebar's grouping is a pure function precisely so its edges can be
 * pinned here: date bucket boundaries (the part nobody notices is wrong until a
 * document lands in "before" on a Monday morning), documents carrying several
 * codes, and refs pointing at codes that no longer exist.
 *
 * Dates are built with local-time constructors on purpose — the buckets are
 * calendar-based in the viewer's timezone, so ISO-Z literals would test the
 * wrong thing.
 */

const at = (
  y: number,
  m: number,
  d: number,
  h = 12,
  min = 0,
): string => new Date(y, m - 1, d, h, min).toISOString();

// A Wednesday, so "this week" (Monday-based) has room on both sides.
const NOW = new Date(2026, 6, 15, 14, 30); // 15 July 2026, 14:30 local

const doc = (
  overrides: Partial<GroupableDocument> & { id: string },
): GroupableDocument => ({
  title: overrides.id,
  createdAt: at(2026, 7, 15),
  updatedAt: at(2026, 7, 15),
  ...overrides,
});

describe("timeBucketFor", () => {
  it("puts anything from the current calendar day in 'today'", () => {
    expect(timeBucketFor(at(2026, 7, 15, 0, 0), NOW)).toBe("today");
    expect(timeBucketFor(at(2026, 7, 15, 23, 59), NOW)).toBe("today");
  });

  it("separates yesterday from the rest of the week", () => {
    expect(timeBucketFor(at(2026, 7, 14, 23, 59), NOW)).toBe("yesterday");
    expect(timeBucketFor(at(2026, 7, 13), NOW)).toBe("thisWeek"); // Monday
  });

  it("starts the week on Monday", () => {
    // Sunday 12 July belongs to the previous week, not to "this week".
    expect(timeBucketFor(at(2026, 7, 12), NOW)).toBe("thisMonth");
    expect(timeBucketFor(at(2026, 7, 13), NOW)).toBe("thisWeek");
  });

  it("falls back to the calendar month, then to 'before'", () => {
    expect(timeBucketFor(at(2026, 7, 1), NOW)).toBe("thisMonth");
    expect(timeBucketFor(at(2026, 6, 30), NOW)).toBe("before");
  });

  it("treats a Monday 'now' as having an empty week above it", () => {
    const monday = new Date(2026, 6, 13, 9, 0);
    expect(timeBucketFor(at(2026, 7, 12), monday)).toBe("yesterday");
    expect(timeBucketFor(at(2026, 7, 11), monday)).toBe("thisMonth");
  });
});

describe("groupDocuments — by study", () => {
  const projects = [{ id: "p1" }, { id: "p2" }];
  const documents = [
    doc({ id: "b", projectId: "p1" }),
    doc({ id: "a", projectId: "p1" }),
    doc({ id: "c", projectId: "p2" }),
    doc({ id: "d" }),
  ];

  it("follows the study order and puts unassigned documents last", () => {
    const groups = groupDocuments({
      documents,
      projects,
      groupBy: "study",
      sortBy: "alphabetical",
      now: NOW,
    });

    expect(groups.map((g) => g.key)).toEqual([
      "study:p1",
      "study:p2",
      "study:none",
    ]);
    expect(groups[0].documents.map((d) => d.id)).toEqual(["a", "b"]);
    expect(groups[2].label).toEqual({ type: "study", projectId: null });
  });

  it("drops empty groups", () => {
    const groups = groupDocuments({
      documents: [doc({ id: "a", projectId: "p1" })],
      projects,
      groupBy: "study",
      sortBy: "alphabetical",
      now: NOW,
    });
    expect(groups.map((g) => g.key)).toEqual(["study:p1"]);
  });
});

describe("groupDocuments — by date", () => {
  it("buckets on the requested field, not always on updatedAt", () => {
    const documents = [
      doc({ id: "old-edit", createdAt: at(2026, 5, 2), updatedAt: at(2026, 7, 15) }),
    ];

    const byUpdate = groupDocuments({
      documents,
      projects: [],
      groupBy: "updatedAt",
      sortBy: "alphabetical",
      now: NOW,
    });
    const byCreation = groupDocuments({
      documents,
      projects: [],
      groupBy: "createdAt",
      sortBy: "alphabetical",
      now: NOW,
    });

    expect(byUpdate.map((g) => g.key)).toEqual(["bucket:today"]);
    expect(byCreation.map((g) => g.key)).toEqual(["bucket:before"]);
  });

  it("keeps buckets in chronological order", () => {
    const groups = groupDocuments({
      documents: [
        doc({ id: "old", updatedAt: at(2026, 1, 1) }),
        doc({ id: "now", updatedAt: at(2026, 7, 15) }),
        doc({ id: "week", updatedAt: at(2026, 7, 13) }),
      ],
      projects: [],
      groupBy: "updatedAt",
      sortBy: "alphabetical",
      now: NOW,
    });

    expect(groups.map((g) => g.key)).toEqual([
      "bucket:today",
      "bucket:thisWeek",
      "bucket:before",
    ]);
  });
});

describe("groupDocuments — by codebook", () => {
  const codebooks = [
    {
      id: "cb1",
      codes: [
        { id: "c1", label: "Positive" },
        { id: "c2", label: "Negative" },
      ],
    },
  ];

  it("lists a document under each of its codes", () => {
    const groups = groupDocuments({
      documents: [
        doc({
          id: "both",
          codes: [
            { codebookId: "cb1", codeId: "c1" },
            { codebookId: "cb1", codeId: "c2" },
          ],
        }),
      ],
      projects: [],
      codebooks,
      groupBy: "codebook:cb1",
      sortBy: "alphabetical",
      now: NOW,
    });

    expect(groups.map((g) => g.key)).toEqual([
      "code:cb1:c1",
      "code:cb1:c2",
    ]);
    expect(groups.every((g) => g.documents[0].id === "both")).toBe(true);
  });

  it("collects uncoded documents in a trailing group", () => {
    const groups = groupDocuments({
      documents: [
        doc({ id: "coded", codes: [{ codebookId: "cb1", codeId: "c1" }] }),
        doc({ id: "bare" }),
      ],
      projects: [],
      codebooks,
      groupBy: "codebook:cb1",
      sortBy: "alphabetical",
      now: NOW,
    });

    expect(groups.at(-1)?.key).toBe("code:cb1:none");
    expect(groups.at(-1)?.documents.map((d) => d.id)).toEqual(["bare"]);
  });

  it("treats a ref to a deleted code as uncoded rather than hiding the document", () => {
    const groups = groupDocuments({
      documents: [
        doc({ id: "stale", codes: [{ codebookId: "cb1", codeId: "gone" }] }),
      ],
      projects: [],
      codebooks,
      groupBy: "codebook:cb1",
      sortBy: "alphabetical",
      now: NOW,
    });

    expect(groups.map((g) => g.key)).toEqual(["code:cb1:none"]);
    expect(groups[0].documents.map((d) => d.id)).toEqual(["stale"]);
  });

  it("gives sub-codes their own group, labelled by their full path", () => {
    const nested = [
      {
        id: "cb1",
        codes: [
          {
            id: "c1",
            label: "Positive",
            children: [{ id: "c1a", label: "Hedged" }],
          },
        ],
      },
    ];

    const groups = groupDocuments({
      documents: [
        doc({ id: "sub", codes: [{ codebookId: "cb1", codeId: "c1a" }] }),
      ],
      projects: [],
      codebooks: nested,
      groupBy: "codebook:cb1",
      sortBy: "alphabetical",
      now: NOW,
    });

    // The parent group is empty and dropped; the sub-code keeps its own.
    expect(groups.map((g) => g.key)).toEqual(["code:cb1:c1a"]);
    expect(groups[0].label).toMatchObject({ label: "Positive › Hedged" });
  });

  it("does not put a document under the parent of the code it carries", () => {
    const nested = [
      {
        id: "cb1",
        codes: [
          {
            id: "c1",
            label: "Positive",
            children: [{ id: "c1a", label: "Hedged" }],
          },
        ],
      },
    ];

    const groups = groupDocuments({
      documents: [
        doc({ id: "sub", codes: [{ codebookId: "cb1", codeId: "c1a" }] }),
        doc({ id: "parent", codes: [{ codebookId: "cb1", codeId: "c1" }] }),
      ],
      projects: [],
      codebooks: nested,
      groupBy: "codebook:cb1",
      sortBy: "alphabetical",
      now: NOW,
    });

    const byKey = Object.fromEntries(
      groups.map((g) => [g.key, g.documents.map((d) => d.id)]),
    );
    expect(byKey["code:cb1:c1"]).toEqual(["parent"]);
    expect(byKey["code:cb1:c1a"]).toEqual(["sub"]);
  });

  it("ignores codes belonging to another codebook", () => {
    const groups = groupDocuments({
      documents: [
        doc({ id: "other", codes: [{ codebookId: "cb2", codeId: "c1" }] }),
      ],
      projects: [],
      codebooks,
      groupBy: "codebook:cb1",
      sortBy: "alphabetical",
      now: NOW,
    });

    expect(groups.map((g) => g.key)).toEqual(["code:cb1:none"]);
  });

  it("returns nothing but the uncoded group when the codebook is unknown", () => {
    const groups = groupDocuments({
      documents: [doc({ id: "a" })],
      projects: [],
      codebooks,
      groupBy: "codebook:missing",
      sortBy: "alphabetical",
      now: NOW,
    });
    expect(groups.map((g) => g.key)).toEqual(["code:missing:none"]);
  });
});

describe("sortDocuments", () => {
  const documents = [
    doc({ id: "b", title: "Beta 10", updatedAt: at(2026, 7, 1), createdAt: at(2026, 6, 1) }),
    doc({ id: "a", title: "beta 2", updatedAt: at(2026, 7, 10), createdAt: at(2026, 5, 1) }),
  ];

  it("sorts alphabetically, case-insensitively and numerically", () => {
    expect(sortDocuments(documents, "alphabetical").map((d) => d.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("sorts dates most recent first", () => {
    expect(sortDocuments(documents, "updatedAt").map((d) => d.id)).toEqual([
      "a",
      "b",
    ]);
    expect(sortDocuments(documents, "createdAt").map((d) => d.id)).toEqual([
      "b",
      "a",
    ]);
  });

  it("does not mutate its input", () => {
    const original = [...documents];
    sortDocuments(documents, "updatedAt");
    expect(documents).toEqual(original);
  });
});

describe("codebookIdFromGroupBy", () => {
  it("extracts the id only for codebook groupings", () => {
    expect(codebookIdFromGroupBy("codebook:abc")).toBe("abc");
    expect(codebookIdFromGroupBy("study")).toBeNull();
    expect(codebookIdFromGroupBy("updatedAt")).toBeNull();
  });
});
