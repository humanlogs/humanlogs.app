import { describe, expect, it } from "vitest";
import type { TranscriptionSegment } from "@/hooks/use-transcriptions";
import { docToSegments } from "@/components/transcriptions/editor/text/collab/doc-to-segments";
import { doc, docOf, isMonotonic, ref, timeOf, words } from "../helpers/pm-doc";

/**
 * `docToSegments` is the keystone of the collaborative editor: the Y.Doc holds
 * text/structure only, so every client must DERIVE the same per-word timestamps
 * from (converged doc + shared timing reference). If this function stops being a
 * pure, deterministic function of those two inputs, clients silently diverge —
 * the single worst failure mode of the collab feature.
 *
 * These tests pin that contract down.
 * (These replace the former `collab/timing.proto.ts` verification script.)
 */

const reference = ref(
  ["Bonjour", 0, 0.5],
  ["tout", 0.5, 0.8],
  ["le", 0.8, 0.9],
  ["monde", 0.9, 1.5],
);

describe("docToSegments — structure projection", () => {
  it("splits a paragraph into word / spacing tokens", () => {
    const segs = docToSegments(doc("Bonjour le monde"), null);
    expect(segs.map((s) => s.text)).toEqual(["Bonjour", " ", "le", " ", "monde"]);
    expect(segs.map((s) => s.type)).toEqual([
      "word",
      "spacing",
      "word",
      "spacing",
      "word",
    ]);
  });

  it("carries the paragraph speakerId onto every token", () => {
    const segs = docToSegments(doc("Salut toi", "speaker_3"), null);
    expect(segs.every((s) => s.speakerId === "speaker_3")).toBe(true);
  });

  it("marks a paragraph boundary with a 2-char '\\n\\n' spacing", () => {
    const segs = docToSegments(
      docOf([
        { speakerId: "speaker_0", content: ["Bonjour"] },
        { speakerId: "speaker_1", content: ["Salut"] },
      ]),
      null,
    );
    const boundary = segs.find((s) => s.type === "spacing" && s.text === "\n\n");
    expect(boundary).toBeDefined();
    // Flat char offsets must stay in sync with PM positions (PMpos == offset + 1),
    // which is what the audio cursor and search rely on.
    expect(segs.map((s) => s.text).join("")).toBe("Bonjour\n\nSalut");
  });

  it("maps editor marks onto segment modifiers", () => {
    const segs = docToSegments(
      docOf([
        {
          content: [
            { text: "gras", marks: ["bold"] },
            " ",
            { text: "souligne", marks: ["underline", "italic"] },
          ],
        },
      ]),
      null,
    );
    expect(words(segs).find((w) => w.text === "gras")?.modifiers).toEqual(["b"]);
    expect(words(segs).find((w) => w.text === "souligne")?.modifiers).toEqual([
      "i",
      "u",
    ]);
  });

  it("turns a hard break into a newline spacing", () => {
    const segs = docToSegments(
      docOf([{ content: ["un", { br: true }, "deux"] }]),
      null,
    );
    expect(segs.map((s) => s.text).join("")).toBe("un\ndeux");
  });

  it("survives an empty document", () => {
    expect(() => docToSegments(doc(""), reference)).not.toThrow();
    expect(() => docToSegments(doc(""), null)).not.toThrow();
  });
});

describe("docToSegments — timestamp carrying", () => {
  it("keeps exact reference times when the text is unchanged", () => {
    const segs = docToSegments(doc("Bonjour tout le monde"), reference);
    expect(timeOf(segs, "Bonjour")).toEqual([0, 0.5]);
    expect(timeOf(segs, "monde")).toEqual([0.9, 1.5]);
  });

  it("keeps neighbours exact across an insertion and interpolates the new word", () => {
    const segs = docToSegments(doc("Bonjour tout le grand monde"), reference);
    expect(timeOf(segs, "le")).toEqual([0.8, 0.9]);
    expect(timeOf(segs, "monde")).toEqual([0.9, 1.5]);

    const grand = words(segs).find((s) => s.text === "grand")!;
    expect(grand.start).toBeGreaterThanOrEqual(0.8);
    expect(grand.end).toBeLessThanOrEqual(1.5);
  });

  it("keeps the unchanged middle exact when edits are scattered (LCS alignment)", () => {
    // Prefix/suffix trimming alone would lose this: both ends changed.
    const segs = docToSegments(doc("Salut tout le pays"), reference);
    expect(timeOf(segs, "tout")).toEqual([0.5, 0.8]);
    expect(timeOf(segs, "le")).toEqual([0.8, 0.9]);
  });

  it("ignores case and surrounding punctuation when matching words", () => {
    const segs = docToSegments(doc("bonjour, tout le monde."), reference);
    expect(timeOf(segs, "bonjour,")).toEqual([0, 0.5]);
    expect(timeOf(segs, "monde.")).toEqual([0.9, 1.5]);
  });

  it("keeps timestamps monotonic non-decreasing even with an unrelated doc", () => {
    const segs = docToSegments(doc("un deux trois quatre cinq"), reference);
    expect(isMonotonic(segs)).toBe(true);
  });

  it("does not crash with no reference at all", () => {
    const segs = docToSegments(doc("Bonjour le monde"), null);
    expect(words(segs)).toHaveLength(3);
    expect(words(segs).every((w) => w.start === undefined)).toBe(true);
  });
});

describe("docToSegments — convergence contract", () => {
  it("is a pure function: same input → identical output", () => {
    const d = doc("Bonjour tout le grand monde");
    expect(docToSegments(d, reference)).toEqual(docToSegments(d, reference));
  });

  it("two clients holding the converged doc derive identical timestamps", () => {
    // Both clients received the same Yjs state, so their PM docs are equal; the
    // timing reference is pinned in the Y.Doc, so it is equal too.
    const clientA = docToSegments(doc("Bonjour beau monde"), reference);
    const clientB = docToSegments(doc("Bonjour beau monde"), reference);
    expect(clientA).toEqual(clientB);
  });

  it("is order-independent: the derivation never reads local mutable state", () => {
    const d1 = doc("Bonjour tout le monde");
    const d2 = doc("Bonjour le monde");
    // Deriving d2 after d1 must equal deriving d2 first — a client that joined
    // late (and therefore never saw d1) has to land on the same answer.
    docToSegments(d1, reference);
    const afterD1 = docToSegments(d2, reference);
    const standalone = docToSegments(d2, reference);
    expect(afterD1).toEqual(standalone);
  });

  it("refreshing the shared reference is a fixed point (no drift over a session)", () => {
    // The save leader periodically republishes the derived words as the new
    // shared reference. Re-deriving against it must change nothing, otherwise
    // timestamps would creep on every refresh of a long editing session.
    const d = doc("Bonjour tout le grand monde");
    const first = docToSegments(d, reference);
    const refreshed = words(first) as TranscriptionSegment[];
    expect(docToSegments(d, refreshed)).toEqual(first);
  });

  it("stays stable across repeated refresh cycles", () => {
    const d = doc("Bonjour tout le grand monde nouveau");
    let current = docToSegments(d, reference);
    for (let i = 0; i < 5; i++) {
      const next = docToSegments(d, words(current));
      expect(next).toEqual(current);
      current = next;
    }
  });
});

describe("docToSegments — performance guards", () => {
  const N = 3000;
  const bigRef: TranscriptionSegment[] = Array.from({ length: N }, (_, i) => ({
    type: "word",
    text: `w${i}`,
    start: i * 0.3,
    end: i * 0.3 + 0.25,
  }));

  it("stays exact and fast for a clustered edit in a 3000-word transcript", () => {
    const parts = bigRef.map((w, i) =>
      i >= 1000 && i < 1010 ? `x${i}` : (w.text as string),
    );
    const t0 = performance.now();
    const segs = docToSegments(doc(parts.join(" ")), bigRef);
    const ms = performance.now() - t0;

    expect(timeOf(segs, "w1550")).toEqual([465, 465.25]);
    expect(timeOf(segs, "w990")).toEqual([297, 297.25]);
    // Runs on every (debounced) keystroke of the save leader — a regression here
    // freezes the editor on long interviews.
    expect(ms).toBeLessThan(300);
  });

  it("stays exact when edits are scattered over the whole doc", () => {
    // Prefix/suffix trimming buys nothing here (both ends changed) and the region
    // is far too large for the quadratic DP, so this only works because the
    // alignment splits on anchors before falling back to LCS.
    const parts = bigRef.map((w, i) =>
      i % 100 === 0 ? `x${i}` : (w.text as string),
    );
    const t0 = performance.now();
    const segs = docToSegments(doc(parts.join(" ")), bigRef);
    const ms = performance.now() - t0;

    expect(timeOf(segs, "w1550")).toEqual([465, 465.25]);
    expect(timeOf(segs, "w2999")).toEqual([
      bigRef[2999].start,
      bigRef[2999].end,
    ]);
    expect(isMonotonic(segs)).toBe(true);
    expect(ms).toBeLessThan(600);
  });

  it("keeps every untouched word exact through a replace-all (dots → ' /')", () => {
    // The bug this pins: replacing every "." across a long transcript changes words
    // from one end to the other AND inserts a token per sentence. Surrendering the
    // whole middle to interpolation moves every word in the document away from its
    // audio — the editor's word→audio links all break at once.
    const vocab =
      "alors je pense que le sujet principal reste vraiment la question de la methode".split(
        " ",
      );
    const texts = Array.from(
      { length: N },
      (_, i) => vocab[i % vocab.length] + (i % 12 === 11 ? "." : ""),
    );
    const reference: TranscriptionSegment[] = texts.map((text, i) => ({
      type: "word",
      text,
      start: i * 0.3,
      end: i * 0.3 + 0.25,
    }));

    const segs = docToSegments(
      doc(texts.join(" ").replaceAll(".", " /")),
      reference,
    );

    // Every original word (i.e. everything but the inserted "/" tokens) must still
    // carry the reference timestamp of the word at the same rank.
    const kept = words(segs).filter((w) => w.text !== "/");
    expect(kept).toHaveLength(N);
    const exact = kept.filter(
      (w, i) => w.start === reference[i].start && w.end === reference[i].end,
    );
    expect(exact).toHaveLength(N);
  });
});
