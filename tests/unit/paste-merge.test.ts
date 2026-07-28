import { docToSegments } from "@/components/transcriptions/editor/text/collab/doc-to-segments";
import {
  applyMergeOps,
  cleanPastedHtml,
  normalizeTypography,
  planPasteMerge,
  type PlanOptions,
} from "@/components/transcriptions/editor/text/utils/paste-merge";
import type { Node as PMNode } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";
import { docOf, ref, timeOf, words } from "../helpers/pm-doc";

/**
 * The Word round trip — copy the transcript out, edit it there, paste it back —
 * used to be a silent data-loss path: a plain paste replaces the whole selection,
 * so every paragraph's `speakerId`, every comment anchor, every remote caret and
 * every derived timestamp is rebuilt from text that mostly did not change.
 *
 * `planPasteMerge` turns that paste into the minimal set of edits. These tests
 * pin down the properties that make it safe: unchanged text is never touched,
 * real edits ARE applied, and anything that isn't a recognizable round trip falls
 * back to a normal paste.
 */

// A short interview, three turns, two speakers — 38 words, enough to clear the
// "this is a transcript, not a snippet" gate.
const P1 =
  "Bonjour et merci d'avoir accepté cet entretien pour notre étude sur le télétravail";
const P2 =
  "Merci à vous je travaille depuis chez moi depuis deux ans et demi maintenant et franchement";
const P3 = "Est-ce que vous pouvez me décrire une journée type s'il vous plaît";

const interview = (): PMNode =>
  docOf([
    { speakerId: "speaker_0", content: [P1] },
    { speakerId: "speaker_1", content: [P2] },
    { speakerId: "speaker_0", content: [P3] },
  ]);

/** Run a full-document paste through the planner and apply it. */
function paste(doc: PMNode, pasted: string[], options?: PlanOptions) {
  const plan = planPasteMerge(doc, 0, doc.content.size, pasted, options);
  if (!plan) return null;
  const tr = EditorState.create({ doc }).tr;
  applyMergeOps(tr, plan.ops);
  return { plan, doc: tr.doc };
}

const paragraphTexts = (doc: PMNode): string[] => {
  const out: string[] = [];
  doc.forEach((node) => out.push(node.textContent));
  return out;
};

const speakerIds = (doc: PMNode): (string | null)[] => {
  const out: (string | null)[] = [];
  doc.forEach((node) => out.push(node.attrs?.speakerId ?? null));
  return out;
};

/** The comment thread ids covering a given word, if any. */
const commentsOn = (doc: PMNode, word: string): string[] => {
  const found: string[] = [];
  doc.descendants((node) => {
    if (!node.isText || !(node.text ?? "").includes(word)) return true;
    for (const mark of node.marks)
      if (mark.type.name === "comment") found.push(mark.attrs.commentIds);
    return true;
  });
  return found;
};

describe("planPasteMerge — an untouched round trip is a no-op", () => {
  it("produces no operation when the pasted text is identical", () => {
    const result = paste(interview(), [P1, P2, P3]);
    expect(result?.plan.ops).toEqual([]);
    expect(result?.plan.changeCount).toBe(0);
  });

  it("ignores the typography a word processor substitutes on its own", () => {
    // Curly apostrophes, a non-breaking space and a zero-width character: Word
    // does this unprompted, and none of it is an edit made by the user.
    const result = paste(interview(), [
      P1.replace("d'avoir", "d\u2019avoir"),
      P2.replace("deux ans", "deux\u00a0ans").replace(
        "franchement",
        "franchement\u200b",
      ),
      P3.replace("s'il", "s\u2019il"),
    ]);
    expect(result?.plan.ops).toEqual([]);
  });

  it("normalizes the rest of the substitutions Word makes", () => {
    expect(normalizeTypography("c\u2019est \u2014 vraiment\u2026")).toBe(
      "c'est - vraiment...",
    );
    expect(normalizeTypography("\u201cciter\u201d")).toBe('"citer"');
  });

  it("keeps document positions stable, so nothing is rewritten", () => {
    const doc = interview();
    const result = paste(doc, [P1, P2, P3]);
    expect(result?.doc.eq(doc)).toBe(true);
  });
});

describe("planPasteMerge — real edits are applied surgically", () => {
  it("replaces a corrected word and leaves the rest of the document alone", () => {
    const result = paste(interview(), [
      P1.replace("télétravail", "téléconsultation"),
      P2,
      P3,
    ]);
    expect(result?.plan.ops).toHaveLength(1);
    expect(result?.plan.ops[0].kind).toBe("replace");
    expect(paragraphTexts(result!.doc)).toEqual([
      P1.replace("télétravail", "téléconsultation"),
      P2,
      P3,
    ]);
  });

  it("applies punctuation and capitalization changes (they are real edits)", () => {
    const result = paste(interview(), [P1, `${P2}.`, P3]);
    expect(result?.plan.changeCount).toBe(1);
    expect(paragraphTexts(result!.doc)[1]).toBe(`${P2}.`);
  });

  it("inserts added words without touching their neighbours", () => {
    const edited = P2.replace("je travaille", "je travaille vraiment");
    const result = paste(interview(), [P1, edited, P3]);
    expect(result?.plan.ops.map((op) => op.kind)).toEqual(["insert"]);
    expect(paragraphTexts(result!.doc)[1]).toBe(edited);
  });

  it("deletes removed words without leaving a double space", () => {
    const edited = P2.replace(" et franchement", "");
    const result = paste(interview(), [P1, edited, P3]);
    expect(result?.plan.ops.map((op) => op.kind)).toEqual(["delete"]);
    expect(paragraphTexts(result!.doc)[1]).toBe(edited);
    expect(paragraphTexts(result!.doc)[1]).not.toMatch(/ {2}/);
  });

  it("handles several scattered edits in one transaction", () => {
    const result = paste(interview(), [
      P1.replace("Bonjour", "Bonsoir"),
      P2,
      P3.replace("journée type", "journée normale"),
    ]);
    expect(result?.plan.ops).toHaveLength(2);
    expect(paragraphTexts(result!.doc)[1]).toBe(P2);
  });
});

describe("planPasteMerge — what a plain paste would destroy", () => {
  it("keeps every speaker attribute, including on edited paragraphs", () => {
    const result = paste(interview(), [
      P1.replace("télétravail", "téléconsultation"),
      P2,
      P3,
    ]);
    // The whole point: Word gives back paragraphs with no `data-speaker-id`, and
    // a replacing paste would collapse the transcript onto `speaker_0`.
    expect(speakerIds(result!.doc)).toEqual([
      "speaker_0",
      "speaker_1",
      "speaker_0",
    ]);
  });

  it("keeps a comment anchor on untouched text", () => {
    const doc = docOf([
      { speakerId: "speaker_0", content: [P1] },
      {
        speakerId: "speaker_1",
        content: [
          "Merci à vous je travaille depuis chez moi depuis ",
          { text: "deux ans et demi", comment: "thread-1" },
          " maintenant et franchement",
        ],
      },
      { speakerId: "speaker_0", content: [P3] },
    ]);
    const result = paste(doc, [P1.replace("Bonjour", "Bonsoir"), P2, P3]);
    expect(commentsOn(result!.doc, "deux ans et demi")).toEqual(["thread-1"]);
  });

  it("keeps the comment anchor and the marks of a word it replaces", () => {
    const doc = docOf([
      { speakerId: "speaker_0", content: [P1] },
      {
        speakerId: "speaker_1",
        content: [
          "Merci à vous je travaille depuis chez moi depuis ",
          { text: "deux ans et demi", marks: ["bold"], comment: "thread-1" },
          " maintenant et franchement",
        ],
      },
      { speakerId: "speaker_0", content: [P3] },
    ]);
    const result = paste(doc, [
      P1,
      P2.replace("deux ans et demi", "trois ans et demi"),
      P3,
    ]);
    // The corrected word inherits the marks of the word it replaces, so the
    // highlight band and the formatting keep no hole.
    expect(commentsOn(result!.doc, "trois")).toEqual(["thread-1"]);
    const bolded: string[] = [];
    result!.doc.descendants((node) => {
      if (node.isText && node.marks.some((m) => m.type.name === "bold"))
        bolded.push(node.text ?? "");
      return true;
    });
    expect(bolded.join("")).toContain("trois");
  });

  it("preserves derived per-word timestamps for unchanged words", () => {
    // The end-to-end payoff: docToSegments carries timestamps from the shared
    // timing reference. A full replacement makes the changed "middle" span the
    // whole transcript; a surgical merge keeps it one word wide.
    const doc = docOf([{ speakerId: "speaker_0", content: [P1] }]);
    const timing = ref(
      ...P1.split(" ").map(
        (word, i) => [word, i, i + 0.9] as [string, number, number],
      ),
    );
    const before = docToSegments(doc, timing);
    const merged = paste(
      docOf([
        { speakerId: "speaker_0", content: [P1] },
        { speakerId: "speaker_1", content: [P2] },
        { speakerId: "speaker_0", content: [P3] },
      ]),
      [P1.replace("télétravail", "téléconsultation"), P2, P3],
    );
    const after = docToSegments(merged!.doc, timing);

    for (const word of words(before)) {
      if (word.text === "télétravail") continue;
      expect(timeOf(after, word.text)).toEqual([word.start, word.end]);
    }
  });
});

describe("planPasteMerge — paragraph-level changes", () => {
  it("inserts a paragraph added in Word, inheriting the previous speaker", () => {
    const added = "Oui tout à fait je vous écoute avec grand plaisir";
    const result = paste(interview(), [P1, P2, added, P3]);
    expect(paragraphTexts(result!.doc)).toEqual([P1, P2, added, P3]);
    // Word has no speaker information to give back, so the new paragraph takes
    // the speaker of the turn it continues.
    expect(speakerIds(result!.doc)).toEqual([
      "speaker_0",
      "speaker_1",
      "speaker_1",
      "speaker_0",
    ]);
  });

  it("deletes a paragraph removed in Word and keeps the others intact", () => {
    const result = paste(interview(), [P1, P3]);
    expect(paragraphTexts(result!.doc)).toEqual([P1, P3]);
    expect(speakerIds(result!.doc)).toEqual(["speaker_0", "speaker_0"]);
  });

  it("recognizes an edited paragraph instead of deleting and re-inserting it", () => {
    const edited = P2.replace("deux ans et demi", "trois ans");
    const result = paste(interview(), [P1, edited, P3]);
    expect(result?.plan.stats.paragraphsDeleted).toBe(0);
    expect(result?.plan.stats.paragraphsInserted).toBe(0);
    expect(speakerIds(result!.doc)).toEqual([
      "speaker_0",
      "speaker_1",
      "speaker_0",
    ]);
  });
});

describe("planPasteMerge — falls back to a normal paste", () => {
  it("when the selection stops mid-paragraph", () => {
    const doc = interview();
    // Starting one character into the first paragraph: the diff would delete the
    // text the user never selected.
    expect(planPasteMerge(doc, 2, doc.content.size, [P1, P2, P3])).toBeNull();
  });

  it("when the paste is a short snippet rather than a transcript", () => {
    const doc = interview();
    expect(planPasteMerge(doc, 0, doc.content.size, ["deux ans"])).toBeNull();
  });

  it("when the pasted content is unrelated to the selection", () => {
    const doc = interview();
    const unrelated = [
      "The quarterly revenue report shows a significant increase across all the",
      "European markets during the second half of the fiscal year under review",
      "and the board has approved the corresponding budget for the next period",
    ];
    expect(planPasteMerge(doc, 0, doc.content.size, unrelated)).toBeNull();
  });

  it("rather than emptying the document", () => {
    const doc = interview();
    const unrelated = [
      "The quarterly revenue report shows a significant increase across all the",
      "European markets during the second half of the fiscal year under review",
      "and the board has approved the corresponding budget for the next period",
    ];
    // Even with the similarity gate disabled, replacing every paragraph is never
    // a round trip — the schema also requires at least one paragraph.
    expect(
      planPasteMerge(doc, 0, doc.content.size, unrelated, {
        minSimilarity: 0,
      }),
    ).toBeNull();
  });
});

describe("cleanPastedHtml", () => {
  it("strips the noise Word puts in text/html", () => {
    const html = `<!--[if gte mso 9]><xml><w:WordDocument/></xml><![endif]-->
      <style>p.MsoNormal { margin: 0 }</style>
      <p class="MsoNormal">Bonjour<o:p></o:p>&nbsp;tout le monde​</p>`;
    const cleaned = cleanPastedHtml(html);
    expect(cleaned).not.toContain("MsoNormal { margin");
    expect(cleaned).not.toContain("<o:p>");
    expect(cleaned).not.toContain("&nbsp;");
    expect(cleaned).not.toContain("​");
    expect(cleaned).toContain("Bonjour");
    expect(cleaned).toContain("tout le monde");
  });
});
