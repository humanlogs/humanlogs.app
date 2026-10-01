import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { ySyncPluginKey } from "@tiptap/y-tiptap";
import {
  ConfidenceMark,
  confidenceAt,
  confidenceClearPlugin,
  confidenceRangeAt,
} from "@/components/transcriptions/editor/text/extensions/confidence-mark";
import {
  LOW_CONFIDENCE_MARK,
  PRESERVE_CONFIDENCE_META,
  isLowConfidence,
  readConfidence,
} from "@/components/transcriptions/editor/text/utils/confidence";
import { docToSegments } from "@/components/transcriptions/editor/text/collab/doc-to-segments";
import { segmentsToHtml } from "@/components/transcriptions/editor/text/utils/html";
import { normalizeEditorSegments } from "@/components/transcriptions/editor/text/hooks/use-normalize-editor-segments";
import type { TranscriptionSegment } from "@/hooks/use-transcriptions";

/**
 * Doubtful words: the STT engine's per-word confidence, shown as a red squiggle until
 * someone corrects or validates the word.
 *
 * The doubt is a mark so it travels with the word (mapping, CRDT, save/reload). What
 * these tests pin down is when it must go and when it must NOT: an edit to the word
 * clears it, but neither the seed (which replaces the whole document), nor a
 * collaborator's change arriving through Yjs, nor a structural change like a speaker
 * relabel may read as "the user corrected this word".
 */

const schema = getSchema([
  Document,
  Paragraph.extend({
    addAttributes: () => ({ speakerId: { default: "speaker_0" } }),
  }),
  Text,
  ConfidenceMark,
] as any);
const type = schema.marks[LOW_CONFIDENCE_MARK];

//                1234567890123456789
const LINE = "le chat dort bien"; // "chat" = 4..8, "dort" = 9..13

function makeState(doubtful: [number, number, string][] = [[4, 8, "0.30"]]) {
  let doc = schema.node("doc", null, [
    schema.node("paragraph", { speakerId: "speaker_0" }, [schema.text(LINE)]),
  ]);
  let state = EditorState.create({
    doc,
    schema,
    plugins: [confidenceClearPlugin(type)],
  });
  const tr = state.tr;
  for (const [from, to, confidence] of doubtful) {
    tr.addMark(from, to, type.create({ confidence }));
  }
  state = state.apply(tr);
  doc = state.doc;
  return state;
}

/** The text currently carrying the mark, one entry per contiguous run. */
function doubtfulText(state: EditorState): string[] {
  const out: string[] = [];
  state.doc.descendants((node) => {
    if (node.isText && type.isInSet(node.marks)) out.push(node.text!);
  });
  return out;
}

describe("readConfidence", () => {
  const word = (extra: object): TranscriptionSegment =>
    ({ type: "word", text: "x", ...extra }) as TranscriptionSegment;

  it("reads each provider's field as a probability", () => {
    expect(readConfidence(word({ confidence: 0.42 }))).toBe(0.42); // Gladia / ours
    expect(readConfidence(word({ logprob: Math.log(0.25) }))).toBeCloseTo(0.25); // ElevenLabs
    expect(readConfidence(word({ probability: 0.8 }))).toBe(0.8); // Whisper
    expect(readConfidence(word({}))).toBeUndefined();
  });

  it("ignores spacing tokens, which ElevenLabs also scores", () => {
    expect(
      readConfidence({ type: "spacing", text: " ", logprob: -3 } as any),
    ).toBeUndefined();
  });

  it("flags only words under the threshold", () => {
    expect(isLowConfidence(word({ confidence: 0.2 }))).toBe(true);
    expect(isLowConfidence(word({ confidence: 0.95 }))).toBe(false);
    expect(isLowConfidence(word({}))).toBe(false);
  });
});

describe("the save/reload round trip", () => {
  it("seeds a span on doubtful words only, never on the spaces", () => {
    const html = segmentsToHtml([
      { type: "word", text: "le", speakerId: "s", confidence: 0.9 },
      { type: "spacing", text: " ", speakerId: "s" },
      { type: "word", text: "chat", speakerId: "s", confidence: 0.3 },
      { type: "spacing", text: " ", speakerId: "s" },
      { type: "word", text: "dort", speakerId: "s", confidence: 0.1 },
    ]);
    expect(html).toContain('<span data-confidence="0.30">chat</span>');
    expect(html).toContain('<span data-confidence="0.10">dort</span>');
    expect(html).not.toContain('data-confidence="0.90"');
  });

  it("projects the mark back onto the word and nothing else", () => {
    const segments = docToSegments(makeState().doc, null);
    expect(
      segments.filter((s) => s.confidence !== undefined).map((s) => s.text),
    ).toEqual(["chat"]);
    expect(segments.find((s) => s.text === "chat")?.confidence).toBe(0.3);
  });

  it("keeps the most doubtful half when two tokens merge into one word", () => {
    const merged = normalizeEditorSegments([
      { type: "word", text: "aujourd'", speakerId: "s", confidence: 0.8 },
      { type: "word", text: "hui", speakerId: "s", confidence: 0.2 },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].confidence).toBe(0.2);
  });
});

describe("editing clears the doubt", () => {
  it("typing inside a doubtful word clears the whole word", () => {
    let state = makeState([
      [4, 8, "0.30"],
      [9, 13, "0.20"],
    ]);
    state = state.apply(state.tr.insertText("h", 6)); // "chhat"
    expect(doubtfulText(state)).toEqual(["dort"]);
  });

  it("deleting a letter of a doubtful word clears it", () => {
    let state = makeState();
    state = state.apply(state.tr.delete(7, 8)); // "cha"
    expect(doubtfulText(state)).toEqual([]);
  });

  it("typing elsewhere leaves it alone", () => {
    let state = makeState();
    state = state.apply(state.tr.insertText("!", 18)); // after "bien"
    expect(doubtfulText(state)).toEqual(["chat"]);
  });

  it("a new word typed after a doubtful one leaves it; letters glued to it clear it", () => {
    let state = makeState();
    // A space then a new word after "chat": a different word, "chat" untouched.
    state = state.apply(state.tr.insertText(" gris", 8));
    expect(doubtfulText(state)).toEqual(["chat"]);
    // Letters glued to it make it a different word: that is an edit of "chat".
    state = state.apply(state.tr.insertText("s", 8)); // "chats"
    expect(doubtfulText(state)).toEqual([]);
  });

  it("does not clear on the seed, a collaborator's change or a speaker relabel", () => {
    let state = makeState();
    state = state.apply(
      state.tr.insertText("h", 6).setMeta(PRESERVE_CONFIDENCE_META, true),
    );
    expect(doubtfulText(state)).toEqual(["chhat"]);

    state = state.apply(
      state.tr.insertText("h", 6).setMeta(ySyncPluginKey, {
        isChangeOrigin: true,
      }),
    );
    expect(doubtfulText(state)).toEqual(["chhhat"]);

    state = state.apply(
      state.tr.setNodeMarkup(0, undefined, { speakerId: "speaker_1" }),
    );
    expect(doubtfulText(state)).toEqual(["chhhat"]);
  });
});

describe("validating", () => {
  const at = (state: EditorState, from: number, to = from) =>
    state.apply(
      state.tr.setSelection(TextSelection.create(state.doc, from, to)),
    );

  it("finds the doubtful run under a caret, including at its edges", () => {
    const state = makeState();
    expect(confidenceRangeAt(at(state, 6), type)).toEqual({ from: 4, to: 8 });
    expect(confidenceRangeAt(at(state, 4), type)).toEqual({ from: 4, to: 8 });
    expect(confidenceRangeAt(at(state, 8), type)).toEqual({ from: 4, to: 8 });
    expect(confidenceRangeAt(at(state, 11), type)).toBeNull();
    expect(confidenceAt(at(state, 6), type)).toBe(0.3);
  });

  it("removes the doubt without touching the text", () => {
    let state = at(makeState(), 6);
    const range = confidenceRangeAt(state, type)!;
    state = state.apply(state.tr.removeMark(range.from, range.to, type));
    expect(doubtfulText(state)).toEqual([]);
    expect(state.doc.textContent).toBe(LINE);
  });

  it("a selection validates every doubtful word inside it", () => {
    let state = at(
      makeState([
        [4, 8, "0.30"],
        [9, 13, "0.20"],
      ]),
      1,
      18,
    );
    const range = confidenceRangeAt(state, type)!;
    state = state.apply(state.tr.removeMark(range.from, range.to, type));
    expect(doubtfulText(state)).toEqual([]);
  });
});
