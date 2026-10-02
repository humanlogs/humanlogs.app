import { Mark, getMarkRange, mergeAttributes } from "@tiptap/core";
import type { MarkType, Node as PMNode } from "@tiptap/pm/model";
import {
  Plugin,
  PluginKey,
  type EditorState,
  type Transaction,
} from "@tiptap/pm/state";
import { ReplaceStep } from "@tiptap/pm/transform";
import { ySyncPluginKey } from "@tiptap/y-tiptap";
import {
  LOW_CONFIDENCE_MARK,
  PRESERVE_CONFIDENCE_META,
  parseConfidence,
} from "../utils/confidence";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    lowConfidence: {
      /**
       * Mark the doubtful words under the selection (or the caret) as checked: the
       * underline goes, the text stays exactly as it is.
       */
      validateConfidence: () => ReturnType;
    };
  }
}

/** The text of a textblock with one character per position (leaves count as "\n"). */
function blockText(block: PMNode): string {
  return block.textBetween(0, block.content.size, "\n", "\n");
}

/** Widen `pos` to the start of the word it touches, inside its textblock. */
function wordStart(doc: PMNode, pos: number): number {
  const $pos = doc.resolve(pos);
  if (!$pos.parent.isTextblock) return pos;
  const text = blockText($pos.parent);
  let i = $pos.parentOffset;
  while (i > 0 && /\S/.test(text[i - 1])) i--;
  return pos - ($pos.parentOffset - i);
}

/** Widen `pos` to the end of the word it touches, inside its textblock. */
function wordEnd(doc: PMNode, pos: number): number {
  const $pos = doc.resolve(pos);
  if (!$pos.parent.isTextblock) return pos;
  const text = blockText($pos.parent);
  let i = $pos.parentOffset;
  while (i < text.length && /\S/.test(text[i])) i++;
  return pos + (i - $pos.parentOffset);
}

/**
 * The ranges of `state.doc` whose text was typed, pasted or deleted by the
 * transactions that produced it, widened to whole words.
 *
 * Only `ReplaceStep`s count. Mark steps (bold, a comment, a coding) map nothing, and a
 * `ReplaceAroundStep` is structural — a speaker change re-labels a paragraph without
 * touching a letter of it, and must not read as its first word having been corrected.
 *
 * Remote transactions are skipped (the collaborator who typed already cleared their
 * own marks, and that removal arrives through the CRDT), as is the seed.
 */
export function editedWordRanges(
  transactions: readonly Transaction[],
  state: EditorState,
): [number, number][] {
  const ranges: [number, number][] = [];
  transactions.forEach((tr, t) => {
    if (!tr.docChanged) return;
    if (tr.getMeta(ySyncPluginKey) || tr.getMeta(PRESERVE_CONFIDENCE_META)) {
      return;
    }
    tr.steps.forEach((step, s) => {
      if (!(step instanceof ReplaceStep)) return;
      step.getMap().forEach((_oldStart, _oldEnd, newStart, newEnd) => {
        // Into the final document: the rest of this transaction, then the others.
        let from = tr.mapping.slice(s + 1).map(newStart, -1);
        let to = tr.mapping.slice(s + 1).map(newEnd, 1);
        for (const later of transactions.slice(t + 1)) {
          from = later.mapping.map(from, -1);
          to = later.mapping.map(to, 1);
        }
        const size = state.doc.content.size;
        from = Math.max(0, Math.min(from, size));
        to = Math.max(from, Math.min(to, size));
        // Widen only across an edge where the change is glued to a word: "s" typed
        // after "chat" edits "chat", " gris" typed after it does not. A deletion
        // (empty range) joins whatever it now touches on both sides.
        const text = state.doc.textBetween(from, to, "\n", "\n");
        const gluedLeft = from === to || /\S/.test(text[0] ?? "");
        const gluedRight =
          from === to || /\S/.test(text[text.length - 1] ?? "");
        ranges.push([
          gluedLeft ? wordStart(state.doc, from) : from,
          gluedRight ? wordEnd(state.doc, to) : to,
        ]);
      });
    });
  });
  return ranges;
}

/**
 * Remove the doubt from every word the user touched. Correcting a word is the
 * strongest possible statement that it has been checked, whatever the new spelling.
 */
export function clearEditedConfidence(
  transactions: readonly Transaction[],
  state: EditorState,
  type: MarkType,
): Transaction | null {
  const ranges = editedWordRanges(transactions, state).filter(
    ([from, to]) => to > from && state.doc.rangeHasMark(from, to, type),
  );
  if (!ranges.length) return null;
  const tr = state.tr;
  for (const [from, to] of ranges) tr.removeMark(from, to, type);
  return tr;
}

export const confidenceClearPluginKey = new PluginKey("lowConfidenceClear");

export function confidenceClearPlugin(type: MarkType): Plugin {
  return new Plugin({
    key: confidenceClearPluginKey,
    appendTransaction: (transactions, _oldState, newState) =>
      clearEditedConfidence(transactions, newState, type),
  });
}

/**
 * The range `validateConfidence` acts on: the selection, or — for a bare caret — the
 * doubtful run it sits in (the caret at either edge of it counts). Null when there is
 * nothing doubtful there.
 */
export function confidenceRangeAt(
  state: EditorState,
  type: MarkType,
): { from: number; to: number } | null {
  const { from, to, empty, $from } = state.selection;
  if (!empty) {
    return state.doc.rangeHasMark(from, to, type) ? { from, to } : null;
  }
  return (
    getMarkRange($from, type) ??
    (from > 1
      ? (getMarkRange(state.doc.resolve(from - 1), type) ?? null)
      : null)
  );
}

/** The run's confidence at a caret/selection, for the bubble's label. */
export function confidenceAt(
  state: EditorState,
  type: MarkType,
): number | undefined {
  const range = confidenceRangeAt(state, type);
  if (!range) return undefined;
  let lowest: number | undefined;
  state.doc.nodesBetween(range.from, range.to, (node) => {
    const mark = type.isInSet(node.marks);
    const value = mark ? parseConfidence(mark.attrs.confidence) : undefined;
    if (value !== undefined && (lowest === undefined || value < lowest)) {
      lowest = value;
    }
  });
  return lowest;
}

/**
 * A word the speech-to-text engine was unsure of.
 *
 * It is a mark, not a decoration computed from the saved projection, because the
 * doubt has to travel WITH the word: through ProseMirror mapping as text around it
 * changes, through the Yjs CRDT to every collaborator, and back into the flat
 * projection (the `confidence` field, see doc-to-segments.ts / utils/html.ts) so a
 * reload shows exactly the words still unchecked. A decoration keyed on offsets would
 * drift the moment anyone typed.
 *
 * It goes away two ways: the word is edited (the plugin below), or someone validates
 * it as heard correctly (`validateConfidence`). Both are ordinary document changes, so
 * they are shared, saved and undoable like any other. Hiding the underline is a view
 * preference (`showConfidence`) and never touches the marks.
 */
export const ConfidenceMark = Mark.create({
  name: LOW_CONFIDENCE_MARK,

  // Typing at the edge of a doubtful word does not make the new text doubtful.
  inclusive: false,

  addAttributes() {
    return {
      confidence: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-confidence") ?? "",
        renderHTML: (attrs) =>
          attrs.confidence ? { "data-confidence": attrs.confidence } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-confidence]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { class: "hl-confidence" }),
      0,
    ];
  },

  addCommands() {
    return {
      validateConfidence:
        () =>
        ({ state, tr, dispatch }) => {
          const range = confidenceRangeAt(state, this.type);
          if (!range) return false;
          if (dispatch) tr.removeMark(range.from, range.to, this.type);
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [confidenceClearPlugin(this.type)];
  },
});
