import { Mark, mergeAttributes } from "@tiptap/core";

export interface CodingMarkOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    coding: {
      /** Replace the codings set on the current selection with exactly `codingIds`. */
      setCoding: (codingIds: string) => ReturnType;
      /** Remove the coding mark from the current selection. */
      unsetCoding: () => ReturnType;
    };
  }
}

/** Split the stored `data-coding-id` value into coding ids. */
export function parseCodingIds(raw: unknown): string[] {
  return typeof raw === "string" ? raw.split(/\s+/).filter(Boolean) : [];
}

/**
 * Serialize coding ids into the stored attribute value — deduplicated and sorted, so
 * two runs carrying the same codings produce byte-identical attributes. ProseMirror
 * compares mark attributes by value, so without a canonical order it would treat them
 * as different marks and pointlessly split the text runs.
 */
export function formatCodingIds(ids: Iterable<string>): string {
  return Array.from(new Set(ids)).filter(Boolean).sort().join(" ");
}

/**
 * Inline mark anchoring codings to a passage of the transcript.
 *
 * Deliberately the same shape as {@link CommentMark}: the mark carries only ids, the
 * meaning (which code, from which codebook, by whom) lives in the `Coding` table. Being
 * a normal mark, a coded passage moves with the text through ProseMirror mapping and
 * the Yjs CRDT, round-trips through the flat segment projection via the `codings` field
 * (doc-to-segments.ts and utils/html.ts), and therefore survives save → reseed and is
 * versioned with the transcript.
 *
 * ProseMirror allows only ONE mark of a given type per character, so a single mark
 * carries EVERY coding covering it, as a space-separated set. That is what lets a
 * passage be coded several times over — by several codes, from several codebooks, by
 * several researchers — which is the whole point: the highlight is then painted from
 * the union (see lib/codebooks/coding.ts `codingBackground`).
 */
export const CodingMark = Mark.create<CodingMarkOptions>({
  name: "coding",

  // Do not extend the mark when typing at its edges — a coding stays scoped to the
  // passage it was applied to.
  inclusive: false,

  // Keep the anchor when the paragraph is split.
  keepOnSplit: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      codingIds: {
        default: "",
        parseHTML: (el) =>
          formatCodingIds(parseCodingIds(el.getAttribute("data-coding-id"))),
        renderHTML: (attrs) =>
          attrs.codingIds ? { "data-coding-id": attrs.codingIds } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-coding-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: "hl-coding",
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setCoding:
        (codingIds: string) =>
        ({ commands }) =>
          commands.setMark(this.name, { codingIds }),
      unsetCoding:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});
