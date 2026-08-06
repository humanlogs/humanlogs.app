import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import type { TranscriptionSegment } from "@/hooks/use-transcriptions";
import { destroyLocalDb, putDocumentIndex } from "@/lib/local/db.browser";
import { buildPhraseIndex, codingIdsOf } from "@/lib/local/phrase-index";
import { queryPhrases } from "@/lib/local/phrase-query";
import type { PhraseStreamResult } from "@/lib/local/phrase-stream";
import {
  queryStudy,
  readPhraseRows,
  type StudyQuery,
} from "@/lib/local/query-store.browser";

/**
 * The reader that drives the streaming query from IndexedDB.
 *
 * The accumulator it feeds is tested on its own (`phrase-stream.test.ts`) and
 * against the materialising query it replaces. What is left — and what cannot be
 * reasoned about on paper — is the WALK: rows come out in batches, and a batch
 * boundary that falls in the middle of a phrase must neither split it (the
 * accumulator sees each phrase exactly once, complete) nor lose the half that was
 * withheld. So most of these run with a batch of two or three, where every phrase
 * straddles one.
 */

const USER = "user-query";

function segmentsOf(
  turns: Array<{ speakerId: string; text: string }>,
  codings: Record<number, string[]> = {},
): TranscriptionSegment[] {
  const out: TranscriptionSegment[] = [];
  let wordIndex = 0;
  turns.forEach((turn, i) => {
    if (i > 0)
      out.push({ type: "spacing", text: "\n\n", speakerId: turn.speakerId });
    turn.text.split(" ").forEach((word, j) => {
      if (j > 0) {
        // A space between two words carrying the same anchor carries it too —
        // otherwise the span breaks there and one passage becomes two.
        const between = codings[wordIndex - 1]?.filter((id) =>
          (codings[wordIndex] ?? []).includes(id),
        );
        out.push({
          type: "spacing",
          text: " ",
          speakerId: turn.speakerId,
          ...(between?.length ? { codings: between } : {}),
        });
      }
      out.push({
        type: "word",
        text: word,
        speakerId: turn.speakerId,
        ...(codings[wordIndex]?.length ? { codings: codings[wordIndex] } : {}),
      });
      wordIndex++;
    });
  });
  return out;
}

const coding = (id: string, codeId: string, userId = "u1") => ({
  id,
  codebookId: "cb1",
  codeId,
  userId,
});

type Written = {
  phrases: ReturnType<typeof buildPhraseIndex>["phrases"];
  links: ReturnType<typeof buildPhraseIndex>["links"];
};

async function write(
  documentId: string,
  projectId: string | null,
  turns: Array<{ speakerId: string; text: string }>,
  codings: Record<number, string[]>,
  rows: Array<{ id: string; codeId: string; userId?: string }>,
): Promise<Written> {
  const index = buildPhraseIndex({
    documentId,
    projectId,
    segments: segmentsOf(turns, codings),
    codings: rows.map((row) => coding(row.id, row.codeId, row.userId)),
  });
  await putDocumentIndex(USER, {
    document: {
      id: documentId,
      studyKey: projectId ?? "",
      title: `Interview ${documentId}`,
      indexedUpdatedAt: "2026-01-01T00:00:00.000Z",
      indexedCodingSignature: "sig",
    },
    ...index,
  });
  return index;
}

/**
 * Two interviews of one study, plus one filed elsewhere.
 *
 * Every shape the walk has to survive is in here: a passage read as two things (one
 * phrase, two links, two code groups), the same code applied by two authors (one
 * group, one count), and a neighbouring study that must never leak in.
 */
async function corpus(): Promise<Written> {
  const one = await write(
    "docA",
    "study1",
    [
      { speakerId: "speaker_0", text: "et comment ça se passe" },
      { speakerId: "speaker_1", text: "on nous crie dessus tous les jours" },
    ],
    { 1: ["a1"], 7: ["a2", "a5"], 8: ["a2", "a5"], 10: ["a3", "a4"] },
    [
      { id: "a1", codeId: "cadre" },
      { id: "a2", codeId: "violence" },
      { id: "a5", codeId: "institution" },
      { id: "a3", codeId: "violence" },
      { id: "a4", codeId: "violence", userId: "u2" },
    ],
  );
  const two = await write(
    "docB",
    "study1",
    [{ speakerId: "speaker_0", text: "je suis entre deux étages" }],
    { 0: ["b1"], 3: ["b2"], 4: ["b2"] },
    [
      { id: "b1", codeId: "hierarchie", userId: "u2" },
      { id: "b2", codeId: "violence" },
    ],
  );
  await write(
    "docZ",
    "study2",
    [{ speakerId: "speaker_0", text: "rien à voir avec cette étude" }],
    { 0: ["z1"] },
    [{ id: "z1", codeId: "violence" }],
  );
  return {
    phrases: [...one.phrases, ...two.phrases],
    links: [...one.links, ...two.links],
  };
}

/** Groups compared as a set: their order is asserted in `phrase-stream.test.ts`. */
function shapeOf(result: PhraseStreamResult) {
  return {
    total: result.total,
    groups: result.groups
      .map((g) => ({
        key: g.key,
        count: g.count,
        ids: g.refs.map((r) => r.id),
      }))
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)),
  };
}

/** The same question answered by the implementation this one replaces. */
function reference(
  index: Written,
  options: Omit<Parameters<typeof queryPhrases>[0], "phrases" | "links">,
) {
  const result = queryPhrases({ ...index, ...options });
  return {
    total: result.phrases.length,
    groups: result.groups
      .map((g) => ({
        key: g.key,
        count: g.phrases.length,
        ids: g.phrases.map((p) => p.id),
      }))
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)),
  };
}

beforeEach(async () => {
  await destroyLocalDb(USER);
});

describe("queryStudy", () => {
  const cases: Array<{
    name: string;
    options: Omit<StudyQuery, "projectId" | "batchSize">;
  }> = [
    { name: "no filter, ungrouped", options: {} },
    { name: "grouped by code", options: { groupBy: "code" } },
    { name: "grouped by codebook", options: { groupBy: "codebook" } },
    { name: "grouped by document", options: { groupBy: "document" } },
    { name: "grouped by speaker", options: { groupBy: "speaker" } },
    {
      name: "filtered by code",
      options: {
        groupBy: "code",
        filter: { codes: [{ codebookId: "cb1", codeId: "violence" }] },
      },
    },
    {
      name: "filtered by author",
      options: { groupBy: "code", filter: { userIds: ["u2"] } },
    },
    {
      name: "filtered by speaker",
      options: {
        groupBy: "speaker",
        filter: { speakerKeys: ["docA:speaker_1"] },
      },
    },
    {
      name: "filtered by text",
      options: { groupBy: "none", filter: { search: "CRIE" } },
    },
    {
      name: "filtered by text, accent-folded",
      options: { groupBy: "none", filter: { search: "etages" } },
    },
    {
      name: "with the codebook's order, empty groups kept",
      options: {
        groupBy: "code",
        codeOrder: [
          { codebookId: "cb1", codeId: "violence" },
          { codebookId: "cb1", codeId: "silence" },
          { codebookId: "cb1", codeId: "cadre" },
        ],
      },
    },
  ];

  // Two and three, so a batch boundary lands inside a phrase's links in one of them
  // whichever way the rows happen to be ordered — and 4000, the real one.
  for (const batchSize of [2, 3, 4000]) {
    describe(`with batches of ${batchSize}`, () => {
      for (const { name, options } of cases) {
        it(name, async () => {
          const index = await corpus();
          expect(
            shapeOf(
              await queryStudy(USER, {
                projectId: "study1",
                batchSize,
                ...options,
              }),
            ),
          ).toEqual(
            reference(index, {
              ...options,
              filter: { ...options.filter, projectId: "study1" },
            }),
          );
        });
      }
    });
  }

  it("never crosses into another study", async () => {
    await corpus();
    const result = await queryStudy(USER, {
      projectId: "study1",
      groupBy: "document",
      batchSize: 2,
    });
    expect(result.groups.map((g) => g.key).sort()).toEqual([
      "document:docA",
      "document:docB",
    ]);
  });

  it("reads only the document when the filter names exactly one", async () => {
    await corpus();
    const scoped = await queryStudy(USER, {
      projectId: "study1",
      filter: { documentIds: ["docB"] },
      batchSize: 2,
    });
    const wide = await queryStudy(USER, {
      projectId: "study1",
      filter: { documentIds: ["docB", "docA"] },
      groupBy: "document",
      batchSize: 2,
    });
    // The two paths are different indexes; they must answer the same question the
    // same way, or scoping to the open document would silently change the result.
    expect(scoped.total).toBe(2);
    expect(wide.groups.find((g) => g.key === "document:docB")?.count).toBe(
      scoped.total,
    );
  });

  it("drops the links of codes the codebook no longer has", async () => {
    await corpus();
    const result = await queryStudy(USER, {
      projectId: "study1",
      groupBy: "code",
      batchSize: 2,
      sanitize: [{ id: "cb1", codeIds: ["violence"] }],
    });
    expect(result.groups.map((g) => g.key)).toEqual(["code:cb1:violence"]);
  });

  it("keeps a passage a colleague coded through a codebook we do not hold", async () => {
    await corpus();
    const result = await queryStudy(USER, {
      projectId: "study1",
      groupBy: "codebook",
      batchSize: 2,
      sanitize: [{ id: "cbOther", codeIds: [] }],
    });
    expect(result.groups.map((g) => g.key)).toEqual(["codebook:cb1"]);
  });

  it("keeps nothing when a dimension is explicitly empty", async () => {
    await corpus();
    for (const filter of [
      { documentIds: [] },
      { speakerKeys: [] },
      { codes: [] },
    ]) {
      expect(await queryStudy(USER, { projectId: "study1", filter })).toEqual({
        total: 0,
        groups: [],
      });
    }
  });

  it("counts every group but keeps only a page of each", async () => {
    await corpus();
    const result = await queryStudy(USER, {
      projectId: "study1",
      groupBy: "none",
      perGroup: 1,
      batchSize: 2,
    });
    expect(result.total).toBeGreaterThan(1);
    expect(result.groups[0].count).toBe(result.total);
    expect(result.groups[0].refs).toHaveLength(1);
  });

  it("returns references in reading order across a paged walk", async () => {
    await write(
      "docLong",
      "study3",
      [
        {
          speakerId: "speaker_0",
          text: Array.from({ length: 40 }, (_, i) => `mot${i}`).join(" "),
        },
      ],
      Object.fromEntries(
        Array.from({ length: 40 }, (_, i) => [i, [`c${i}`]]),
      ) as Record<number, string[]>,
      Array.from({ length: 40 }, (_, i) => ({ id: `c${i}`, codeId: "theme" })),
    );
    const result = await queryStudy(USER, {
      projectId: "study3",
      groupBy: "none",
      batchSize: 3,
    });
    expect(result.total).toBe(40);
    const offsets = result.groups[0].refs.map((r) => r.offset);
    expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
  });

  it("sees a phrase whose links alone fill a whole batch", async () => {
    // Six codes on one selection: one phrase, six links, batches of two.
    await write(
      "docWide",
      "study4",
      [{ speakerId: "speaker_0", text: "une seule phrase" }],
      { 1: ["w1", "w2", "w3", "w4", "w5", "w6"] },
      Array.from({ length: 6 }, (_, i) => ({
        id: `w${i + 1}`,
        codeId: `code${i + 1}`,
      })),
    );
    const result = await queryStudy(USER, {
      projectId: "study4",
      groupBy: "code",
      batchSize: 2,
    });
    expect(result.total).toBe(1);
    // Every code it carries, none counted twice.
    expect(result.groups).toHaveLength(6);
    expect(result.groups.every((g) => g.count === 1)).toBe(true);
  });

  it("stops when the caller aborts", async () => {
    await corpus();
    const controller = new AbortController();
    controller.abort();
    await expect(
      queryStudy(USER, {
        projectId: "study1",
        batchSize: 2,
        signal: controller.signal,
      }),
    ).rejects.toThrow();
  });
});

describe("readPhraseRows", () => {
  it("returns the text and the codes of the ids it is given, and nothing else", async () => {
    const index = await corpus();
    const wanted = index.phrases.slice(0, 2).map((p) => p.id);
    const { rows, codes } = await readPhraseRows(USER, wanted);

    expect([...rows.keys()].sort()).toEqual([...wanted].sort());
    for (const id of wanted) {
      expect(rows.get(id)?.text).toBe(
        index.phrases.find((p) => p.id === id)?.text,
      );
      expect(
        codes
          .get(id)
          ?.map((link) => link.codingId)
          .sort(),
      ).toEqual(codingIdsOf(id).sort());
    }
  });

  it("restores the study a row belongs to", async () => {
    const index = await corpus();
    const { rows } = await readPhraseRows(USER, [index.phrases[0].id]);
    expect(rows.get(index.phrases[0].id)?.projectId).toBe("study1");
  });

  it("skips an id that is no longer there rather than inventing a row", async () => {
    await corpus();
    const { rows, codes } = await readPhraseRows(USER, ["docA#gone"]);
    expect(rows.size).toBe(0);
    expect(codes.get("docA#gone")).toEqual([]);
  });

  it("asks for nothing when given nothing", async () => {
    const { rows } = await readPhraseRows(USER, []);
    expect(rows.size).toBe(0);
  });
});

describe("codingIdsOf", () => {
  it("recovers a phrase's anchors from its id, without touching the store", async () => {
    const index = await corpus();
    for (const phrase of index.phrases) {
      expect(codingIdsOf(phrase.id)).toEqual(phrase.codingIds);
    }
  });
});
