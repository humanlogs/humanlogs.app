import type { Editor } from "@tiptap/react";
import {
  formatCommentIds,
  parseCommentIds,
} from "../extensions/comment-mark";

/**
 * Editor-side helpers for the comment anchor mark. The note bodies live in the
 * `Comment` table; these functions only manage the `comment` mark that anchors a
 * thread to a range of transcript text.
 */

/** Characters treated as part of a word when snapping a range outwards. */
const WORD_CHAR = /[\w'’-]/;

/**
 * Grow a range so it covers whole words — a comment should never be anchored to
 * "…faudr|ait reformuler la conclu|sion". Both ends are pushed out to the nearest word
 * boundary, after trimming any whitespace the drag picked up; an empty selection
 * becomes the word under the caret, which is what the bold/italic buttons do.
 * Returns null when there is no word to anchor to (e.g. an empty line).
 */
export function expandSelectionToWord(
  editor: Editor,
): { from: number; to: number } | null {
  const { doc } = editor.state;
  let { from, to } = editor.state.selection;

  // Drop leading/trailing whitespace so a sloppy drag doesn't pull in the next word.
  while (to > from && /\s/.test(doc.textBetween(to - 1, to))) to--;
  while (from < to && /\s/.test(doc.textBetween(from, from + 1))) from++;

  const $from = doc.resolve(from);
  const fromText = $from.parent.textContent;
  let fromOffset = $from.parentOffset;
  while (fromOffset > 0 && WORD_CHAR.test(fromText[fromOffset - 1])) {
    fromOffset--;
    from--;
  }

  const $to = doc.resolve(to);
  const toText = $to.parent.textContent;
  let toOffset = $to.parentOffset;
  while (toOffset < toText.length && WORD_CHAR.test(toText[toOffset])) {
    toOffset++;
    to++;
  }

  if (from >= to) return null;

  editor.commands.setTextSelection({ from, to });
  return { from, to };
}

/**
 * Anchor a comment thread to the current selection (expanding to the whole word when
 * the selection is empty). Returns true if a range was marked.
 *
 * Applied run by run, UNIONing the new thread into whatever is already there, because
 * a mark type can sit only once on a character: a plain `setMark` over the range would
 * replace the mark of any thread inside it, silently orphaning its notes. Runs already
 * carrying other threads therefore end up with a mark listing all of them.
 */
export function applyCommentMark(editor: Editor, commentId: string): boolean {
  const range = expandSelectionToWord(editor);
  if (!range) return false;

  const { state, view } = editor;
  const markType = state.schema.marks.comment;
  if (!markType) return false;

  // Marking never moves anything, so positions read from the original doc stay valid
  // for every step in the transaction.
  let tr = state.tr;
  state.doc.nodesBetween(range.from, range.to, (node, pos) => {
    if (!node.isText) return;
    const from = Math.max(pos, range.from);
    const to = Math.min(pos + node.nodeSize, range.to);
    if (from >= to) return;
    const existing = node.marks.find((m) => m.type === markType);
    const ids = formatCommentIds([
      ...parseCommentIds(existing?.attrs.commentIds),
      commentId,
    ]);
    tr = tr.addMark(from, to, markType.create({ commentIds: ids }));
  });

  if (!tr.docChanged) return false;
  view.dispatch(tr);
  return true;
}

/**
 * Drop `commentId` from the document, leaving every other thread untouched — a run
 * shared with another thread keeps its mark minus this one id, and only a run left
 * with no thread at all loses the mark.
 */
export function removeCommentMark(editor: Editor, commentId: string): void {
  const { state, view } = editor;
  const markType = state.schema.marks.comment;
  if (!markType) return;

  const edits: Array<{ from: number; to: number; remaining: string[] }> = [];
  state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    const mark = node.marks.find((m) => m.type === markType);
    if (!mark) return;
    const ids = parseCommentIds(mark.attrs.commentIds);
    if (!ids.includes(commentId)) return;
    edits.push({
      from: pos,
      to: pos + node.nodeSize,
      remaining: ids.filter((id) => id !== commentId),
    });
  });
  if (edits.length === 0) return;

  let tr = state.tr;
  for (const e of edits) {
    tr = e.remaining.length
      ? tr.addMark(
          e.from,
          e.to,
          markType.create({ commentIds: formatCommentIds(e.remaining) }),
        )
      : tr.removeMark(e.from, e.to, markType);
  }
  view.dispatch(tr);
}

/** Every thread covering the current selection, innermost (shortest range) first. */
export function commentIdsAtSelection(editor: Editor): string[] {
  if (!editor.isActive("comment")) return [];
  const ids = parseCommentIds(editor.getAttributes("comment").commentIds);
  return sortByInnermost(editor, ids);
}

/**
 * Order thread ids so the most tightly scoped comes first. With overlapping threads a
 * click lands on several at once, and the one the user meant is the narrowest.
 */
export function sortByInnermost(editor: Editor, ids: string[]): string[] {
  if (ids.length < 2) return ids;
  const width = new Map(
    getCommentRanges(editor).map((r) => [r.anchorId, r.to - r.from]),
  );
  return [...ids].sort(
    (a, b) => (width.get(a) ?? Infinity) - (width.get(b) ?? Infinity),
  );
}

/** All distinct comment thread ids currently present in the document. */
export function commentIdsInDoc(editor: Editor): Set<string> {
  const ids = new Set<string>();
  const markType = editor.state.schema.marks.comment;
  if (!markType) return ids;
  editor.state.doc.descendants((node) => {
    if (!node.isText) return;
    for (const m of node.marks) {
      if (m.type !== markType) continue;
      for (const id of parseCommentIds(m.attrs.commentIds)) ids.add(id);
    }
  });
  return ids;
}

/** The document range covered by a comment thread, plus its anchored text. */
export type CommentRange = {
  anchorId: string;
  from: number;
  to: number;
  text: string;
};

/**
 * One range per comment thread in the document: the span from its first to its last
 * marked character (a thread split by a later overlapping comment is reported as the
 * outer envelope) together with the anchored text.
 */
export function getCommentRanges(editor: Editor): CommentRange[] {
  const markType = editor.state.schema.marks.comment;
  if (!markType) return [];

  const bounds = new Map<string, { from: number; to: number }>();
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    for (const m of node.marks) {
      if (m.type !== markType) continue;
      const from = pos;
      const to = pos + node.nodeSize;
      // One run can belong to several threads at once — widen each of them.
      for (const id of parseCommentIds(m.attrs.commentIds)) {
        const cur = bounds.get(id);
        bounds.set(
          id,
          cur
            ? { from: Math.min(cur.from, from), to: Math.max(cur.to, to) }
            : { from, to },
        );
      }
    }
  });

  return Array.from(bounds.entries()).map(([anchorId, r]) => ({
    anchorId,
    from: r.from,
    to: r.to,
    text: editor.state.doc.textBetween(r.from, r.to, "\n", " "),
  }));
}

/**
 * Threads whose anchored range touches `anchorId`'s: overlapping, or separated only by
 * whitespace within the same block. These are shown alongside the active thread so a
 * comment made next to (or across) an existing one doesn't hide it.
 */
export function getTouchingAnchorIds(
  editor: Editor,
  anchorId: string,
): string[] {
  const ranges = getCommentRanges(editor);
  const active = ranges.find((r) => r.anchorId === anchorId);
  if (!active) return [];

  return ranges
    .filter((r) => {
      if (r.anchorId === anchorId) return false;
      // Overlapping ranges.
      if (r.from < active.to && active.from < r.to) return true;
      // Adjacent ranges: nothing but a little whitespace, no block boundary.
      const gapFrom = r.to <= active.from ? r.to : active.to;
      const gapTo = r.to <= active.from ? active.from : r.from;
      if (gapTo < gapFrom) return false;
      const between = editor.state.doc.textBetween(gapFrom, gapTo, "\n", " ");
      return (
        between.length <= 3 && between.trim() === "" && !between.includes("\n")
      );
    })
    .map((r) => r.anchorId);
}

/** Select a thread's anchored text in the editor and scroll it into view. */
export function selectCommentRange(editor: Editor, anchorId: string): boolean {
  const range = getCommentRanges(editor).find((r) => r.anchorId === anchorId);
  if (!range) return false;
  editor
    .chain()
    .focus()
    .setTextSelection({ from: range.from, to: range.to })
    .scrollIntoView()
    .run();
  return true;
}

/**
 * Condense a quoted phrase to "start […] end" so a thread header stays one or two
 * lines regardless of how much text was commented. Cuts on word boundaries — a quote
 * chopped mid-word reads as broken text rather than as an ellipsis.
 */
export function excerptText(text: string, max = 70): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;

  const headLen = Math.ceil((max - 5) / 2);
  const tailLen = Math.floor((max - 5) / 2);

  const headCut = t.slice(0, headLen);
  const lastSpace = headCut.lastIndexOf(" ");
  const head = (lastSpace > headLen / 2 ? headCut.slice(0, lastSpace) : headCut).trimEnd();

  const tailCut = t.slice(t.length - tailLen);
  const firstSpace = tailCut.indexOf(" ");
  const tail = (
    firstSpace >= 0 && firstSpace < tailLen / 2
      ? tailCut.slice(firstSpace + 1)
      : tailCut
  ).trimStart();

  return `${head} […] ${tail}`;
}
