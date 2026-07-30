import type { Editor } from "@tiptap/react";
import { formatCodingIds, parseCodingIds } from "../extensions/coding-mark";
import { expandSelectionToWord } from "./comment-actions";

/**
 * Editor-side helpers for the coding anchor mark. What a coding *means* lives in the
 * `Coding` table; these functions only manage the `coding` mark that ties it to a
 * passage — the exact counterpart of `comment-actions.ts`.
 */

/**
 * Anchor a coding on the current selection (expanding to whole words, as comments do:
 * a code applied to "…faudr|ait" is a slip, never an intent). Returns true if a range
 * was marked.
 *
 * Applied run by run, UNIONing the new id into whatever is already there, because a
 * mark type can sit only once on a character: a plain `setMark` would replace the mark
 * of every coding inside the range and silently orphan them.
 */
export function applyCodingMark(editor: Editor, codingId: string): boolean {
  const range = expandSelectionToWord(editor);
  if (!range) return false;

  const { state, view } = editor;
  const markType = state.schema.marks.coding;
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
    const ids = formatCodingIds([
      ...parseCodingIds(existing?.attrs.codingIds),
      codingId,
    ]);
    tr = tr.addMark(from, to, markType.create({ codingIds: ids }));
  });

  if (!tr.docChanged) return false;
  view.dispatch(tr);
  return true;
}

/**
 * Drop `codingId` from the document, leaving every other coding untouched — a run
 * shared with another coding keeps its mark minus this one id, and only a run left
 * with no coding at all loses the mark.
 */
export function removeCodingMark(editor: Editor, codingId: string): void {
  const { state, view } = editor;
  const markType = state.schema.marks.coding;
  if (!markType) return;

  const edits: Array<{ from: number; to: number; remaining: string[] }> = [];
  state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    const mark = node.marks.find((m) => m.type === markType);
    if (!mark) return;
    const ids = parseCodingIds(mark.attrs.codingIds);
    if (!ids.includes(codingId)) return;
    edits.push({
      from: pos,
      to: pos + node.nodeSize,
      remaining: ids.filter((id) => id !== codingId),
    });
  });
  if (edits.length === 0) return;

  let tr = state.tr;
  for (const e of edits) {
    tr = e.remaining.length
      ? tr.addMark(
          e.from,
          e.to,
          markType.create({ codingIds: formatCodingIds(e.remaining) }),
        )
      : tr.removeMark(e.from, e.to, markType);
  }
  view.dispatch(tr);
}

/** The document range covered by a coding, plus the text it holds. */
export type CodingRange = {
  codingId: string;
  from: number;
  to: number;
  text: string;
};

/**
 * One range per coding in the document: from its first to its last marked character.
 * A coding split by a later overlapping one is reported as the outer envelope, which
 * is what the "codes on the current selection" test wants.
 */
export function getCodingRanges(editor: Editor): CodingRange[] {
  const markType = editor.state.schema.marks.coding;
  if (!markType) return [];

  const bounds = new Map<string, { from: number; to: number }>();
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    for (const m of node.marks) {
      if (m.type !== markType) continue;
      const from = pos;
      const to = pos + node.nodeSize;
      for (const id of parseCodingIds(m.attrs.codingIds)) {
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

  return Array.from(bounds.entries()).map(([codingId, r]) => ({
    codingId,
    from: r.from,
    to: r.to,
    text: editor.state.doc.textBetween(r.from, r.to, "\n", " "),
  }));
}

/**
 * The distinct `data-coding-id` attribute VALUES in the document — "a b" and "b" being
 * two of them, not three ids.
 *
 * This is what the highlight stylesheet is keyed on: a run's colour depends on the whole
 * set of codings covering it (one colour, or stripes of several), and the attribute is
 * canonical — deduplicated and sorted by `formatCodingIds` — so an exact-match selector
 * on it is stable. A coded document has a handful of distinct combinations, not one per
 * passage, which is what keeps the generated stylesheet small.
 */
export function codingAttrValuesInDoc(editor: Editor): string[] {
  const values = new Set<string>();
  const markType = editor.state.schema.marks.coding;
  if (!markType) return [];
  editor.state.doc.descendants((node) => {
    if (!node.isText) return;
    for (const m of node.marks) {
      if (m.type !== markType) continue;
      const value = formatCodingIds(parseCodingIds(m.attrs.codingIds));
      if (value) values.add(value);
    }
  });
  return Array.from(values);
}

/** All coding ids present in the document — the set the stored rows are reconciled to. */
export function codingIdsInDoc(editor: Editor): Set<string> {
  const ids = new Set<string>();
  const markType = editor.state.schema.marks.coding;
  if (!markType) return ids;
  editor.state.doc.descendants((node) => {
    if (!node.isText) return;
    for (const m of node.marks) {
      if (m.type !== markType) continue;
      for (const id of parseCodingIds(m.attrs.codingIds)) ids.add(id);
    }
  });
  return ids;
}

/**
 * The codings covering a range, in document order.
 *
 * Used to answer "does this selection already carry code X?" — which is what turns the
 * menu into a toggle. A coding only counts when it covers the range ENTIRELY: a code
 * applied to one word of a three-word selection must not read as "the selection is
 * coded", or clicking would remove a coding the researcher never selected.
 */
export function codingIdsCoveringRange(
  editor: Editor,
  from: number,
  to: number,
): string[] {
  if (to <= from) return [];
  return getCodingRanges(editor)
    .filter((r) => r.from <= from && r.to >= to)
    .sort((a, b) => a.from - b.from || a.to - b.to)
    .map((r) => r.codingId);
}
