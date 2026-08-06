import { describe, expect, it } from "vitest";
import type { TranscriptionSegment } from "@/hooks/use-transcriptions";
import { buildPhraseIndex, type CodingRef } from "@/lib/local/phrase-index";
import { queryPhrases } from "@/lib/local/phrase-query";
import {
  createPhraseStream,
  streamFromLinks,
  takeRefs,
  type PhraseStreamResult,
  type StreamedGroup,
} from "@/lib/local/phrase-stream";

/**
 * The streaming query has one job the materialising one did not: to answer
 * without holding the study. That makes it easy to be subtly different —
 * a count that double-counts a passage two people coded the same way, a page in
 * the wrong order, a group that never appears because nothing was retained long
 * enough to create it.
 *
 * So most of these tests assert AGAINST the old implementation on the same data.
 * It is still there, still tested, and still the definition of the right answer;
 * this is the version that has to scale.
 */

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

const coding = (
  id: string,
  codeId: string,
  userId = "u1",
  codebookId = "cb1",
): CodingRef => ({ id, codebookId, codeId, userId });

/** Two interviews, overlapping codes, two authors, one code applied twice. */
function corpus() {
  const one = buildPhraseIndex({
    documentId: "docA",
    projectId: "study1",
    segments: segmentsOf(
      [
        { speakerId: "speaker_0", text: "et comment ça se passe" },
        { speakerId: "speaker_1", text: "on nous crie dessus tous les jours" },
      ],
      { 1: ["a1"], 7: ["a2", "a5"], 8: ["a2", "a5"], 10: ["a3", "a4"] },
    ),
    codings: [
      coding("a1", "cadre"),
      // One passage read as two things: it belongs to two code groups.
      coding("a2", "violence"),
      coding("a5", "institution"),
      coding("a3", "violence"),
      // The same code on the same passage by someone else: one group, one count.
      coding("a4", "violence", "u2"),
    ],
  });
  const two = buildPhraseIndex({
    documentId: "docB",
    projectId: "study1",
    segments: segmentsOf(
      [{ speakerId: "speaker_0", text: "je suis entre deux étages" }],
      { 0: ["b1"], 3: ["b2"] },
    ),
    codings: [coding("b1", "hierarchie", "u2"), coding("b2", "violence")],
  });
  return {
    phrases: [...one.phrases, ...two.phrases],
    links: [...one.links, ...two.links],
  };
}

/**
 * The two implementations, reduced to what they both claim.
 *
 * Groups are compared as a SET: their order was an accident of storage in the
 * old implementation and is a deliberate rule in the new one (see `ordered`),
 * which is asserted on its own below. What must agree is which groups exist,
 * how many passages each holds, and which passages those are.
 */
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

function reference(
  index: ReturnType<typeof corpus>,
  options: Parameters<typeof queryPhrases>[0],
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

describe("the streaming query agrees with the materialising one", () => {
  const index = corpus();
  const cases: Array<{
    name: string;
    options: Omit<Parameters<typeof queryPhrases>[0], "phrases" | "links">;
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
      name: "filtered by document",
      options: { groupBy: "document", filter: { documentIds: ["docB"] } },
    },
    {
      name: "filtered by speaker",
      options: {
        groupBy: "speaker",
        filter: { speakerKeys: ["docA:speaker_1"] },
      },
    },
    {
      name: "scoped to the study",
      options: { groupBy: "code", filter: { projectId: "study1" } },
    },
    {
      name: "an empty code array keeps nothing",
      options: { groupBy: "code", filter: { codes: [] } },
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

  for (const { name, options } of cases) {
    it(name, () => {
      expect(shapeOf(streamFromLinks(index.links, options))).toEqual(
        reference(index, { ...index, ...options }),
      );
    });
  }
});

describe("createPhraseStream", () => {
  const index = corpus();

  it("counts a passage once however many people coded it the same way", () => {
    const result = streamFromLinks(index.links, { groupBy: "code" });
    const violence = result.groups.find((g) => g.key === "code:cb1:violence");
    // «les» carries violence from two authors; it is one row under that code.
    expect(violence?.count).toBe(violence?.refs.length);
    expect(new Set(violence?.refs.map((r) => r.id)).size).toBe(
      violence?.refs.length,
    );
  });

  it("counts a passage once overall, even when it lands in two groups", () => {
    const result = streamFromLinks(index.links, { groupBy: "code" });
    const grouped = result.groups.reduce((sum, g) => sum + g.count, 0);
    // Grouping by code is not a partition, so the groups sum higher than the
    // total. The total is distinct passages — what the panel's header shows.
    expect(result.total).toBeLessThan(grouped);
    expect(result.total).toBe(new Set(index.phrases.map((p) => p.id)).size);
  });

  it("orders the groups by size when the codebook does not order them", () => {
    const keys = streamFromLinks(index.links, { groupBy: "code" }).groups.map(
      (g) => g.key,
    );
    const counts = streamFromLinks(index.links, { groupBy: "code" }).groups.map(
      (g) => g.count,
    );
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    // Deterministic, so the list does not reshuffle as a study is re-indexed.
    expect(
      streamFromLinks([...index.links].reverse(), {
        groupBy: "code",
      }).groups.map((g) => g.key),
    ).toEqual(keys);
  });

  it("puts the codebook's own order first when it has one", () => {
    const groups = streamFromLinks(index.links, {
      groupBy: "code",
      codeOrder: [
        { codebookId: "cb1", codeId: "silence" },
        { codebookId: "cb1", codeId: "cadre" },
      ],
    }).groups;
    expect(groups.slice(0, 2).map((g) => g.key)).toEqual([
      "code:cb1:silence",
      "code:cb1:cadre",
    ]);
    // The codes it does not list still appear, after, biggest first.
    expect(groups[2].key).toBe("code:cb1:violence");
  });

  it("orders each group by document, then by position in it", () => {
    const [group] = streamFromLinks(index.links, { groupBy: "none" }).groups;
    const order = group.refs.map((r) => `${r.documentId}:${r.offset}`);
    expect([...order].sort()).toEqual(order);
  });

  it("keeps only a page per group, but still counts the rest", () => {
    const result = streamFromLinks(index.links, {
      groupBy: "none",
      perGroup: 2,
    });
    expect(result.groups[0].refs).toHaveLength(2);
    expect(result.groups[0].count).toBe(result.total);
    expect(result.total).toBeGreaterThan(2);
  });

  it("keeps the EARLIEST rows when it truncates, not the first seen", () => {
    // Fed back to front; the page must still be the start of the document.
    const stream = createPhraseStream({ groupBy: "none", perGroup: 2 });
    const byPhrase = new Map<string, (typeof index.links)[number][]>();
    for (const link of index.links) {
      const bucket = byPhrase.get(link.phraseId) ?? [];
      bucket.push(link);
      byPhrase.set(link.phraseId, bucket);
    }
    for (const [id, links] of [...byPhrase].reverse())
      stream.addPhrase(id, links);

    const forwards = streamFromLinks(index.links, {
      groupBy: "none",
      perGroup: 2,
    });
    expect(stream.result().groups[0].refs).toEqual(forwards.groups[0].refs);
  });

  it("restricts to the ids a search pass survived", () => {
    const wanted = new Set([index.phrases[1].id]);
    const result = streamFromLinks(index.links, {
      groupBy: "none",
      only: wanted,
    });
    expect(result.total).toBe(1);
    expect(result.groups[0].refs[0].id).toBe(index.phrases[1].id);
  });

  it("drops the links of a code the codebook no longer has", () => {
    const kept = streamFromLinks(index.links, {
      groupBy: "code",
      sanitize: [{ id: "cb1", codeIds: ["violence"] }],
    });
    expect(kept.groups.map((g) => g.key)).toEqual(["code:cb1:violence"]);
    // A codebook this account does not hold is not a deletion: a colleague coding
    // through a prism we cannot read still counts.
    expect(
      streamFromLinks(index.links, {
        groupBy: "codebook",
        sanitize: [{ id: "cbElsewhere", codeIds: [] }],
      }).groups.map((g) => g.key),
    ).toEqual(["codebook:cb1"]);
  });

  it("holds nothing per phrase — a large corpus costs the page, not the corpus", () => {
    // Same two links repeated across many phrases: the accumulator must not grow
    // with the number of phrases it has seen.
    const stream = createPhraseStream({ groupBy: "code", perGroup: 10 });
    const template = index.links[0];
    for (let n = 0; n < 50_000; n++) {
      stream.addPhrase(`p${n}`, [
        { ...template, phraseId: `p${n}`, offset: n },
      ]);
    }
    const result = stream.result();
    expect(result.total).toBe(50_000);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].count).toBe(50_000);
    expect(result.groups[0].refs).toHaveLength(10);
  });
});

/**
 * The three numbers `takeRefs` returns are three different questions, and the list
 * grows on one of them, deepens on another and prints the third. Confusing them is
 * how a panel either stops short of rows it has, or climbs forever towards rows it
 * never fetched.
 */
describe("takeRefs", () => {
  const group = (key: string, refs: number, count = refs): StreamedGroup => ({
    key,
    label: { type: "all" },
    count,
    refs: Array.from({ length: refs }, (_, i) => ({
      id: `${key}-${i}`,
      documentId: "doc",
      offset: i,
    })),
  });

  it("keeps everything when the page is bigger than the result", () => {
    const page = takeRefs([group("a", 2), group("b", 3)], 60);
    expect(page.shown).toBe(5);
    expect(page.available).toBe(5);
    expect(page.total).toBe(5);
  });

  it("cuts a group mid-way and stops there", () => {
    const page = takeRefs([group("a", 2), group("b", 5)], 4);
    expect(page.groups.map((g) => g.refs.length)).toEqual([2, 2]);
    expect(page.shown).toBe(4);
    expect(page.available).toBe(7);
  });

  it("keeps an empty group even past the budget — it says something", () => {
    const page = takeRefs([group("a", 4), group("empty", 0)], 2);
    expect(page.groups.map((g) => g.key)).toEqual(["a", "empty"]);
  });

  it("separates what was not kept from what was not mounted", () => {
    // A group of 900 passages whose pass retained 300: scrolling can reach 300,
    // and the 600 behind it need a deeper pass, not a bigger page.
    const page = takeRefs([group("big", 300, 900)], 60);
    expect(page.shown).toBe(60);
    expect(page.available).toBe(300);
    expect(page.total).toBe(900);
  });
});
