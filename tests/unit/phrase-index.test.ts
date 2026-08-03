import { describe, expect, it } from "vitest";
import type { TranscriptionSegment } from "@/hooks/use-transcriptions";
import {
  buildPhraseIndex,
  type CodingRef,
  type PhraseCodeRow,
} from "@/lib/local/phrase-index";
import {
  documentsMatchingCodes,
  phraseMatchesAnchors,
  queryPhrases,
  sanitizeLinks,
  speakerKey,
  speakersMatchingCodes,
  takeGroups,
  type PhraseGroup,
} from "@/lib/local/phrase-query";

/**
 * The index is the only thing standing between a researcher and "show me every
 * passage coded «violence» across the study". It is derived, rebuilt on every
 * resync and never repaired by hand — so if the derivation is wrong, the panel is
 * quietly wrong for the whole corpus and nothing else notices.
 */

/** Build a flat projection out of `"speaker: text"` lines, coding words by index. */
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
        // Whitespace inside a coded run carries the anchors too — that is what the
        // editor writes, and dropping it here would split one excerpt per word.
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

describe("buildPhraseIndex", () => {
  it("turns a coded run into one phrase carrying the run's text and speaker", () => {
    const segments = segmentsOf(
      [
        { speakerId: "speaker_0", text: "Comment ça se passe" },
        { speakerId: "speaker_1", text: "on nous crie dessus tous les jours" },
      ],
      { 5: ["c1"], 6: ["c1"], 7: ["c1"] },
    );

    const { phrases, links } = buildPhraseIndex({
      documentId: "doc1",
      projectId: "study1",
      segments,
      codings: [coding("c1", "violence")],
    });

    expect(phrases).toHaveLength(1);
    expect(phrases[0].text).toBe("nous crie dessus");
    expect(phrases[0].speakerId).toBe("speaker_1");
    expect(phrases[0].documentId).toBe("doc1");
    expect(phrases[0].projectId).toBe("study1");
    expect(phrases[0].codingIds).toEqual(["c1"]);
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      phraseId: phrases[0].id,
      codeId: "violence",
      codebookId: "cb1",
      userId: "u1",
      speakerId: "speaker_1",
    });
  });

  it("makes two codes on the same span ONE phrase with two codes", () => {
    const segments = segmentsOf(
      [{ speakerId: "speaker_0", text: "on nous crie dessus" }],
      {
        2: ["c1", "c2"],
        3: ["c1", "c2"],
      },
    );

    const { phrases, links } = buildPhraseIndex({
      documentId: "doc1",
      segments,
      codings: [coding("c1", "violence"), coding("c2", "institution")],
    });

    expect(phrases).toHaveLength(1);
    expect(phrases[0].text).toBe("crie dessus");
    expect(links.map((l) => l.codeId).sort()).toEqual([
      "institution",
      "violence",
    ]);
  });

  it("keeps overlapping codings as distinct phrases", () => {
    // «nous crie dessus» coded violence, «dessus» alone coded intensité.
    const segments = segmentsOf(
      [{ speakerId: "speaker_0", text: "on nous crie dessus" }],
      {
        1: ["c1"],
        2: ["c1"],
        3: ["c1", "c2"],
      },
    );

    const { phrases } = buildPhraseIndex({
      documentId: "doc1",
      segments,
      codings: [coding("c1", "violence"), coding("c2", "intensite")],
    });

    const texts = phrases.map((p) => p.text).sort();
    expect(texts).toEqual(["dessus", "nous crie dessus"]);
  });

  it("splits a coding that survives in two disjoint runs", () => {
    const segments = segmentsOf(
      [{ speakerId: "speaker_0", text: "un deux trois quatre" }],
      {
        0: ["c1"],
        3: ["c1"],
      },
    );

    const { phrases } = buildPhraseIndex({
      documentId: "doc1",
      segments,
      codings: [coding("c1", "violence")],
    });

    expect(phrases.map((p) => p.text)).toEqual(["un", "quatre"]);
  });

  it("ignores anchors with no coding row, and drops the phrases left empty", () => {
    const segments = segmentsOf(
      [{ speakerId: "speaker_0", text: "un deux trois" }],
      {
        1: ["ghost"],
      },
    );

    const { phrases, links } = buildPhraseIndex({
      documentId: "doc1",
      segments,
      codings: [],
    });

    expect(phrases).toEqual([]);
    expect(links).toEqual([]);
  });

  it("is deterministic: rebuilding an unchanged document keeps the ids", () => {
    const segments = segmentsOf(
      [{ speakerId: "speaker_0", text: "on nous crie dessus" }],
      {
        2: ["c2", "c1"],
        3: ["c1", "c2"],
      },
    );
    const codings = [coding("c1", "violence"), coding("c2", "institution")];

    const a = buildPhraseIndex({ documentId: "doc1", segments, codings });
    const b = buildPhraseIndex({ documentId: "doc1", segments, codings });

    expect(a.phrases.map((p) => p.id)).toEqual(b.phrases.map((p) => p.id));
    expect(a.links.map((l) => l.id)).toEqual(b.links.map((l) => l.id));
  });

  it("orders phrases as they are spoken", () => {
    const segments = segmentsOf(
      [{ speakerId: "speaker_0", text: "un deux trois quatre" }],
      {
        3: ["c2"],
        0: ["c1"],
      },
    );

    const { phrases } = buildPhraseIndex({
      documentId: "doc1",
      segments,
      codings: [coding("c1", "a"), coding("c2", "b")],
    });

    expect(phrases.map((p) => p.text)).toEqual(["un", "quatre"]);
  });
});

describe("queryPhrases", () => {
  const segments = segmentsOf(
    [
      { speakerId: "speaker_0", text: "et comment ça se passe" },
      { speakerId: "speaker_1", text: "on nous crie dessus tous les jours" },
    ],
    { 1: ["c1"], 7: ["c2"], 8: ["c2"], 10: ["c3"] },
  );
  const { phrases, links } = buildPhraseIndex({
    documentId: "doc1",
    projectId: "study1",
    segments,
    codings: [
      coding("c1", "cadre"),
      coding("c2", "violence"),
      coding("c3", "violence", "u2"),
    ],
  });

  it("keeps everything with no filter", () => {
    expect(queryPhrases({ phrases, links }).phrases).toHaveLength(3);
  });

  it("filters by code", () => {
    const result = queryPhrases({
      phrases,
      links,
      filter: { codes: [{ codebookId: "cb1", codeId: "violence" }] },
    });
    expect(result.phrases.map((p) => p.text)).toEqual(["crie dessus", "les"]);
  });

  it("filters by author — my reading is not everyone's", () => {
    const result = queryPhrases({
      phrases,
      links,
      filter: { userIds: ["u2"] },
    });
    expect(result.phrases.map((p) => p.text)).toEqual(["les"]);
  });

  it("filters by speaker", () => {
    const result = queryPhrases({
      phrases,
      links,
      filter: { speakerKeys: [speakerKey("doc1", "speaker_1")] },
    });
    expect(result.phrases.map((p) => p.text)).toEqual(["crie dessus", "les"]);
  });

  it("ANDs the dimensions", () => {
    const result = queryPhrases({
      phrases,
      links,
      filter: {
        codes: [{ codebookId: "cb1", codeId: "violence" }],
        userIds: ["u1"],
      },
    });
    expect(result.phrases.map((p) => p.text)).toEqual(["crie dessus"]);
  });

  it("searches case- and accent-insensitively", () => {
    expect(
      queryPhrases({ phrases, links, filter: { search: "CRIE" } }).phrases,
    ).toHaveLength(1);
  });

  it("keeps an empty array meaning «nothing»", () => {
    expect(
      queryPhrases({ phrases, links, filter: { codes: [] } }).phrases,
    ).toEqual([]);
  });

  it("shows every code a kept phrase carries, not only the filtered one", () => {
    const both = buildPhraseIndex({
      documentId: "doc1",
      segments: segmentsOf([{ speakerId: "speaker_0", text: "on nous crie" }], {
        2: ["c1", "c2"],
      }),
      codings: [coding("c1", "violence"), coding("c2", "institution")],
    });
    const result = queryPhrases({
      ...both,
      filter: { codes: [{ codebookId: "cb1", codeId: "violence" }] },
    });
    expect(
      result.codesByPhrase
        .get(result.phrases[0].id)
        ?.map((l) => l.codeId)
        .sort(),
    ).toEqual(["institution", "violence"]);
  });

  it("lists a two-code phrase under both code groups", () => {
    const both = buildPhraseIndex({
      documentId: "doc1",
      segments: segmentsOf([{ speakerId: "speaker_0", text: "on nous crie" }], {
        2: ["c1", "c2"],
      }),
      codings: [coding("c1", "violence"), coding("c2", "institution")],
    });
    const { groups } = queryPhrases({ ...both, groupBy: "code" });
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.phrases.length === 1)).toBe(true);
  });

  it("keeps the codebook's own order and its uncoded codes when one is given", () => {
    const { groups } = queryPhrases({
      phrases,
      links,
      groupBy: "code",
      codeOrder: [
        { codebookId: "cb1", codeId: "violence" },
        { codebookId: "cb1", codeId: "silence" },
        { codebookId: "cb1", codeId: "cadre" },
      ],
    });
    expect(groups.map((g) => g.key)).toEqual([
      "code:cb1:violence",
      "code:cb1:silence",
      "code:cb1:cadre",
    ]);
    expect(groups[1].phrases).toEqual([]);
  });

  it("partitions by speaker", () => {
    const { groups } = queryPhrases({ phrases, links, groupBy: "speaker" });
    expect(groups.map((g) => g.phrases.length)).toEqual([1, 2]);
  });
});

describe("resolving the document and speaker halves", () => {
  const documents = [
    {
      id: "doc1",
      codes: [{ codebookId: "cbS", codeId: "hopital" }],
      speakerCodes: [],
    },
    {
      id: "doc2",
      codes: [],
      speakerCodes: [
        { codebookId: "cbS", codeId: "cadre", speakerId: "speaker_1" },
      ],
    },
    { id: "doc3", codes: [], speakerCodes: [] },
  ];
  const roster = (id: string) =>
    id === "doc1" ? ["speaker_0", "speaker_1"] : ["speaker_0", "speaker_1"];

  it("matches a document coded either way", () => {
    expect(
      documentsMatchingCodes(documents, [
        { codebookId: "cbS", codeId: "hopital" },
      ]),
    ).toEqual(["doc1"]);
    expect(
      documentsMatchingCodes(documents, [
        { codebookId: "cbS", codeId: "cadre" },
      ]),
    ).toEqual(["doc2"]);
  });

  it("keeps every document when nothing is selected", () => {
    expect(documentsMatchingCodes(documents, [])).toEqual([
      "doc1",
      "doc2",
      "doc3",
    ]);
  });

  it("expands a document-level code to every speaker in it", () => {
    expect(
      speakersMatchingCodes(
        documents,
        [{ codebookId: "cbS", codeId: "hopital" }],
        roster,
      ),
    ).toEqual(["doc1:speaker_0", "doc1:speaker_1"]);
  });

  it("keeps a speaker-level code to that speaker alone", () => {
    expect(
      speakersMatchingCodes(
        documents,
        [{ codebookId: "cbS", codeId: "cadre" }],
        roster,
      ),
    ).toEqual(["doc2:speaker_1"]);
  });
});

describe("sanitizeLinks", () => {
  const link = (codebookId: string, codeId: string): PhraseCodeRow => ({
    id: `${codebookId}:${codeId}`,
    phraseId: "p1",
    codingId: "c1",
    documentId: "doc1",
    projectId: "study1",
    speakerId: "speaker_0",
    codebookId,
    codeId,
    userId: "u1",
  });
  const codebooks = [
    { id: "cb1", codes: [{ id: "violence", label: "Violence" }] },
  ];

  it("drops a link whose code was deleted from a codebook we hold", () => {
    const kept = sanitizeLinks(
      [link("cb1", "violence"), link("cb1", "gone")],
      codebooks,
    );
    expect(kept.map((l) => l.codeId)).toEqual(["violence"]);
  });

  it("keeps a link into a codebook we cannot read — that is a colleague, not a deletion", () => {
    const kept = sanitizeLinks([link("cbOther", "whatever")], codebooks);
    expect(kept).toHaveLength(1);
  });

  it("filters nothing while the codebooks are still loading", () => {
    const links = [link("cb1", "gone")];
    expect(sanitizeLinks(links, [])).toEqual(links);
  });

  it("keeps a sub-code, which lives inside its parent rather than beside it", () => {
    const nested = [
      {
        id: "cb1",
        codes: [
          {
            id: "violence",
            label: "Violence",
            children: [{ id: "verbale", label: "Verbale" }],
          },
        ],
      },
    ];
    expect(sanitizeLinks([link("cb1", "verbale")], nested)).toHaveLength(1);
  });
});

describe("phraseMatchesAnchors", () => {
  const phrase = {
    id: "doc1#c1",
    documentId: "doc1",
    codingIds: ["c1"],
  };

  it("matches a row the table named outright", () => {
    expect(
      phraseMatchesAnchors(phrase, {
        documentId: "doc1",
        phraseId: "doc1#c1",
        codingIds: [],
      }),
    ).toBe(true);
  });

  it("does not match a DIFFERENT row that shares an anchor, when named", () => {
    // The table knows which row it means; a sibling excerpt covering the same
    // coding must not light up with it.
    expect(
      phraseMatchesAnchors(phrase, {
        documentId: "doc1",
        phraseId: "doc1#c1+c2",
        codingIds: ["c1"],
      }),
    ).toBe(false);
  });

  it("matches on a shared anchor when the editor points, since it cannot name a row", () => {
    expect(
      phraseMatchesAnchors(phrase, {
        documentId: "doc1",
        codingIds: ["c1", "c2"],
      }),
    ).toBe(true);
  });

  it("lights up every excerpt covering an overlapped passage", () => {
    const outer = { id: "doc1#c1", documentId: "doc1", codingIds: ["c1"] };
    const inner = { id: "doc1#c2", documentId: "doc1", codingIds: ["c2"] };
    const anchors = { documentId: "doc1", codingIds: ["c1", "c2"] };
    expect(phraseMatchesAnchors(outer, anchors)).toBe(true);
    expect(phraseMatchesAnchors(inner, anchors)).toBe(true);
  });

  it("never crosses documents — anchor ids are unique, but rows are not", () => {
    expect(
      phraseMatchesAnchors(phrase, { documentId: "doc2", codingIds: ["c1"] }),
    ).toBe(false);
  });

  it("matches nothing when there is no focus", () => {
    expect(phraseMatchesAnchors(phrase, null)).toBe(false);
  });
});

describe("takeGroups", () => {
  const group = (key: string, count: number): PhraseGroup => ({
    key,
    label: { type: "all" },
    phrases: Array.from({ length: count }, (_, i) => ({
      id: `${key}-${i}`,
      documentId: "doc1",
      projectId: "study1",
      speakerId: "speaker_0",
      text: "…",
      offset: i,
      codingIds: [`${key}-${i}`],
    })),
  });

  it("returns everything when the page is bigger than the result", () => {
    const page = takeGroups([group("a", 2), group("b", 3)], 60);
    expect(page.groups.map((g) => g.phrases.length)).toEqual([2, 3]);
    expect(page.remaining).toBe(0);
  });

  it("cuts inside the group that crosses the limit", () => {
    const page = takeGroups([group("a", 2), group("b", 5)], 4);
    expect(page.groups.map((g) => g.phrases.length)).toEqual([2, 2]);
    expect(page.remaining).toBe(3);
  });

  it("keeps the empty groups past the limit — they say what was not coded", () => {
    const page = takeGroups(
      [group("a", 4), group("empty", 0), group("b", 2)],
      4,
    );
    expect(page.groups.map((g) => g.key)).toEqual(["a", "empty"]);
    expect(page.remaining).toBe(2);
  });

  it("counts what is left across every group, not only the one it cut", () => {
    const page = takeGroups(
      [group("a", 10), group("b", 10), group("c", 10)],
      5,
    );
    expect(page.remaining).toBe(25);
  });
});
