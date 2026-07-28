import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { CommentMark } from "@/components/transcriptions/editor/text/extensions/comment-mark";
import {
  applyCommentMark,
  commentIdsInDoc,
  getCommentRanges,
  removeCommentMark,
} from "@/components/transcriptions/editor/text/utils/comment-actions";
import { docToSegments } from "@/components/transcriptions/editor/text/collab/doc-to-segments";
import { segmentsToHtml } from "@/components/transcriptions/editor/text/utils/html";

/**
 * Overlapping comment threads.
 *
 * ProseMirror allows only ONE mark of a given type per character, so the `comment`
 * mark carries the whole SET of threads covering a run. Before that, commenting a
 * range that contained an existing thread replaced its mark: the thread lost its
 * anchor, vanished from the rail, and its notes stayed in the database unreachable —
 * silent data loss.
 *
 * These tests pin down that a thread is never destroyed by another, in either nesting
 * direction, and that the set survives the save/reload round trip (doc → flat
 * projection → HTML → doc), which is where a nested-span encoding would collapse.
 */

const schema = getSchema([Document, Paragraph, Text, CommentMark] as any);

/**
 * A stand-in for the TipTap editor exposing just what the comment helpers touch
 * (`state`, `view.dispatch`, `commands.setTextSelection`), over a real ProseMirror
 * document — so the tests exercise the real transactions, not a reimplementation.
 */
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

const comment = (editor: any, from: number, to: number, id: string) => {
  editor.commands.setTextSelection({ from, to });
  return applyCommentMark(editor, id);
};

/** Render the doc as text with `[ids]…[/]` around each marked run, for readable diffs. */
function annotate(editor: any): string {
  let out = "";
  editor.state.doc.descendants((node: any) => {
    if (!node.isText) return;
    const mark = node.marks.find((m: any) => m.type.name === "comment");
    out += mark ? `[${mark.attrs.commentIds}]${node.text}[/]` : node.text;
  });
  return out;
}

const rangeTexts = (editor: any): Record<string, string> =>
  Object.fromEntries(getCommentRanges(editor).map((r) => [r.anchorId, r.text]));

// "Le chat dort ici" spans positions 1..17 in a single-paragraph doc.
const LINE = "Le chat dort ici";

describe("overlapping comment threads", () => {
  it("keeps the inner thread when a new comment swallows it whole", () => {
    const editor = makeEditor(LINE);
    comment(editor, 4, 8, "t1"); // "chat"
    comment(editor, 1, 17, "t2"); // the whole line, containing t1

    expect([...commentIdsInDoc(editor)].sort()).toEqual(["t1", "t2"]);
    expect(annotate(editor)).toBe("[t2]Le [/][t1 t2]chat[/][t2] dort ici[/]");
    expect(rangeTexts(editor)).toEqual({ t1: "chat", t2: LINE });
  });

  it("allows commenting a word already inside another thread", () => {
    const editor = makeEditor(LINE);
    comment(editor, 1, 17, "outer");
    comment(editor, 4, 8, "inner");

    expect([...commentIdsInDoc(editor)].sort()).toEqual(["inner", "outer"]);
    expect(rangeTexts(editor)).toEqual({ outer: LINE, inner: "chat" });
  });

  it("shares only the intersection between two crossing threads", () => {
    const editor = makeEditor(LINE);
    comment(editor, 1, 13, "a"); // "Le chat dort"
    comment(editor, 9, 17, "b"); // "dort ici"

    expect(annotate(editor)).toBe("[a]Le chat [/][a b]dort[/][b] ici[/]");
  });

  it("stores the id set in a canonical order", () => {
    // Same pair applied in the opposite order must produce the same attribute, or
    // ProseMirror would treat the runs as differently marked and split them.
    const first = makeEditor(LINE);
    comment(first, 4, 8, "zeta");
    comment(first, 4, 8, "alpha");
    const second = makeEditor(LINE);
    comment(second, 4, 8, "alpha");
    comment(second, 4, 8, "zeta");

    expect(annotate(first)).toBe(annotate(second));
    expect(annotate(first)).toBe("Le [alpha zeta]chat[/] dort ici");
  });

  it("removes one thread without disturbing the other", () => {
    const editor = makeEditor(LINE);
    comment(editor, 4, 8, "t1");
    comment(editor, 1, 17, "t2");

    removeCommentMark(editor, "t2");
    expect(annotate(editor)).toBe("Le [t1]chat[/] dort ici");
    expect([...commentIdsInDoc(editor)]).toEqual(["t1"]);

    removeCommentMark(editor, "t1");
    expect(annotate(editor)).toBe(LINE);
    expect([...commentIdsInDoc(editor)]).toEqual([]);
  });

  it("survives the save/reload round trip", () => {
    const editor = makeEditor(LINE);
    comment(editor, 4, 8, "t1");
    comment(editor, 1, 17, "t2");

    const segments = docToSegments(editor.state.doc, null);
    expect(
      segments
        .filter((s) => (s.comments ?? []).length > 1)
        .map((s) => [s.text, s.comments]),
    ).toEqual([["chat", ["t1", "t2"]]]);

    const html = segmentsToHtml(segments);
    // ONE span carrying both ids. Nested spans would come back from the parser as a
    // single mark, silently dropping a thread on reload.
    expect(html).toContain('<span data-comment-id="t1 t2">chat</span>');
    expect(html).not.toMatch(/<span[^>]*><span/);
  });
});
