import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { CodingMark } from "@/components/transcriptions/editor/text/extensions/coding-mark";
import { CommentMark } from "@/components/transcriptions/editor/text/extensions/comment-mark";
import {
  applyCodingMark,
  codingAttrValuesInDoc,
  codingIdsCoveringRange,
  codingIdsInDoc,
  getCodingRanges,
  removeCodingMark,
} from "@/components/transcriptions/editor/text/utils/coding-actions";
import {
  applyCommentMark,
  wordRange,
} from "@/components/transcriptions/editor/text/utils/comment-actions";
import { docToSegments } from "@/components/transcriptions/editor/text/collab/doc-to-segments";
import { segmentsToHtml } from "@/components/transcriptions/editor/text/utils/html";

/**
 * Coding anchors.
 *
 * A coded passage is a `coding` mark whose ids point at rows in the `Coding` table. As
 * with comments, ProseMirror allows a single mark of a type per character, so the mark
 * carries the whole SET covering a run — which is exactly what lets one passage carry
 * several codes and several researchers' readings at once. If a second code replaced
 * the first, the retracted coding would stay in the database with nothing pointing at
 * it: an interpretation lost in silence.
 *
 * These tests pin down that no coding destroys another, that comments and codings
 * coexist on the same words (they now say different things — an underline and a
 * background), and that both survive the save/reload round trip through the flat
 * projection, which is where a nested-span encoding would collapse.
 */

const schema = getSchema([
  Document,
  Paragraph,
  Text,
  CommentMark,
  CodingMark,
] as any);

/** The smallest stand-in for the editor the mark helpers actually touch. */
function makeEditor(text: string) {
  const doc = schema.node("doc", null, [
    schema.node("paragraph", { speakerId: "speaker_0" }, [schema.text(text)]),
  ]);
  const editor: any = {
    state: EditorState.create({ doc, schema }),
    get view() {
      return {
        dispatch: (tr: any) => {
          editor.state = editor.state.apply(tr);
        },
      };
    },
    commands: {
      setTextSelection: ({ from, to }: { from: number; to: number }) => {
        editor.state = editor.state.apply(
          editor.state.tr.setSelection(
            TextSelection.create(editor.state.doc, from, to),
          ),
        );
        return true;
      },
    },
  };
  return editor;
}

const code = (editor: any, from: number, to: number, id: string) => {
  editor.commands.setTextSelection({ from, to });
  return applyCodingMark(editor, id);
};

/** Render the doc with `[ids]…[/]` around each coded run, for readable diffs. */
function annotate(editor: any): string {
  let out = "";
  editor.state.doc.descendants((node: any) => {
    if (!node.isText) return;
    const mark = node.marks.find((m: any) => m.type.name === "coding");
    out += mark ? `[${mark.attrs.codingIds}]${node.text}[/]` : node.text;
  });
  return out;
}

// "Le chat dort ici" spans positions 1..17 in a single-paragraph doc.
const LINE = "Le chat dort ici";

describe("coding anchors", () => {
  it("keeps both codes when one covers a passage already coded", () => {
    const editor = makeEditor(LINE);
    code(editor, 4, 8, "c1"); // "chat"
    code(editor, 1, 17, "c2"); // the whole line

    expect([...codingIdsInDoc(editor)].sort()).toEqual(["c1", "c2"]);
    expect(annotate(editor)).toBe("[c2]Le [/][c1 c2]chat[/][c2] dort ici[/]");
    expect(
      Object.fromEntries(getCodingRanges(editor).map((r) => [r.codingId, r.text])),
    ).toEqual({ c1: "chat", c2: LINE });
  });

  it("expands a partial selection to whole words", () => {
    const editor = makeEditor(LINE);
    // "ha" inside "chat": a code applied to half a word is always a slip.
    code(editor, 5, 7, "c1");
    expect(annotate(editor)).toBe("Le [c1]chat[/] dort ici");
  });

  it("stores the id set in a canonical order", () => {
    // Same pair applied in the opposite order must produce the same attribute, or
    // ProseMirror would treat the runs as differently marked and split them — and the
    // generated highlight stylesheet is keyed on that exact attribute value.
    const first = makeEditor(LINE);
    code(first, 4, 8, "zeta");
    code(first, 4, 8, "alpha");
    const second = makeEditor(LINE);
    code(second, 4, 8, "alpha");
    code(second, 4, 8, "zeta");

    expect(annotate(first)).toBe(annotate(second));
    expect(annotate(first)).toBe("Le [alpha zeta]chat[/] dort ici");
    expect(codingAttrValuesInDoc(first)).toEqual(["alpha zeta"]);
  });

  it("removes one coding without disturbing the other", () => {
    const editor = makeEditor(LINE);
    code(editor, 4, 8, "c1");
    code(editor, 1, 17, "c2");

    removeCodingMark(editor, "c2");
    expect(annotate(editor)).toBe("Le [c1]chat[/] dort ici");

    removeCodingMark(editor, "c1");
    expect(annotate(editor)).toBe(LINE);
    expect([...codingIdsInDoc(editor)]).toEqual([]);
  });

  it("reports only the codings that cover the whole selection", () => {
    const editor = makeEditor(LINE);
    code(editor, 4, 8, "word"); // "chat"
    code(editor, 1, 17, "line");

    // Asking about the whole line: a code on one word of it is NOT "the selection is
    // coded" — treating it as such would let one click retract a coding the researcher
    // never pointed at.
    expect(codingIdsCoveringRange(editor, 1, 17)).toEqual(["line"]);
    expect(codingIdsCoveringRange(editor, 4, 8).sort()).toEqual([
      "line",
      "word",
    ]);
    expect(codingIdsCoveringRange(editor, 5, 5)).toEqual([]);
  });

  it("coexists with a comment on the same words", () => {
    const editor = makeEditor(LINE);
    editor.commands.setTextSelection({ from: 4, to: 8 });
    applyCommentMark(editor, "note");
    code(editor, 4, 8, "c1");

    const segments = docToSegments(editor.state.doc, null);
    const chat = segments.find((s) => s.text === "chat");
    expect(chat?.comments).toEqual(["note"]);
    expect(chat?.codings).toEqual(["c1"]);
  });

  it("survives the save/reload round trip", () => {
    const editor = makeEditor(LINE);
    code(editor, 4, 8, "c1");
    code(editor, 1, 17, "c2");

    const segments = docToSegments(editor.state.doc, null);
    expect(
      segments
        .filter((s) => (s.codings ?? []).length > 1)
        .map((s) => [s.text, s.codings]),
    ).toEqual([["chat", ["c1", "c2"]]]);
    // The whitespace inside c2's range belongs to it, or a reloaded passage comes
    // back as one highlight per word with a gap at every space.
    expect(segments.filter((s) => s.type === "spacing" && s.codings?.length))
      .not.toHaveLength(0);

    const html = segmentsToHtml(segments);
    // ONE span carrying both ids: nested spans would come back from the parser as a
    // single mark, silently dropping a coding on reload.
    expect(html).toContain('<span data-coding-id="c1 c2">chat</span>');
  });
});

/**
 * Snapping a range out to whole words.
 *
 * The coding phase runs this on every selection change, so what the researcher sees
 * selected is what will be coded. It used to happen only at the moment of applying,
 * which meant aiming at one thing and silently getting another.
 */
describe("wordRange", () => {
  const editor = makeEditor(LINE);
  const textOf = (range: { from: number; to: number } | null) =>
    range ? editor.state.doc.textBetween(range.from, range.to) : null;

  it("grows a range that starts and ends mid-word", () => {
    expect(textOf(wordRange(editor, { from: 5, to: 11 }))).toBe("chat dort");
  });

  it("drops whitespace a sloppy drag picked up", () => {
    // " chat " must not pull in the words on either side of the spaces.
    expect(textOf(wordRange(editor, { from: 3, to: 9 }))).toBe("chat");
  });

  it("returns the word under a collapsed range", () => {
    expect(textOf(wordRange(editor, { from: 6, to: 6 }))).toBe("chat");
  });

  it("is idempotent, so snapping cannot loop on its own result", () => {
    const once = wordRange(editor, { from: 5, to: 11 })!;
    expect(wordRange(editor, once)).toEqual(once);
  });

  it("has nothing to snap to on whitespace alone", () => {
    // An empty paragraph, or a caret between two spaces: there is no word to round
    // out to, and coding must refuse rather than mark the whitespace.
    const spaces = makeEditor("a   b");
    expect(wordRange(spaces, { from: 3, to: 4 })).toBeNull();
  });
});
