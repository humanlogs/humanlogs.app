import { Mark, mergeAttributes } from "@tiptap/core";

export interface CommentMarkOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    comment: {
      /** Replace the thread set on the current selection with exactly `commentIds`. */
      setComment: (commentIds: string) => ReturnType;
      /** Remove the comment mark from the current selection. */
      unsetComment: () => ReturnType;
    };
  }
}

/** Split the stored `data-comment-id` value into thread ids. */
export function parseCommentIds(raw: unknown): string[] {
  return typeof raw === "string" ? raw.split(/\s+/).filter(Boolean) : [];
}

/**
 * Serialize thread ids into the stored attribute value. Deduplicated and sorted, so
 * two runs covered by the same set of threads produce byte-identical attributes —
 * ProseMirror compares mark attributes by value, so without a canonical order it would
 * treat them as different marks and pointlessly split the text runs.
 */
export function formatCommentIds(ids: Iterable<string>): string {
  return Array.from(new Set(ids)).filter(Boolean).sort().join(" ");
}

/**
 * Inline mark anchoring comment threads to a range of transcript text.
 *
 * The mark only carries thread ids; the note bodies live in the `Comment` table
 * (encrypted, versioned, multi-user). Because it is a normal mark it moves with the
 * text through ProseMirror mapping + the Yjs CRDT, and it round-trips through the flat
 * segment projection via the `comments` field (see doc-to-segments.ts and
 * utils/html.ts) so anchors are versioned with the transcript and survive reseed.
 *
 * ProseMirror allows only ONE mark of a given type per character, so a single mark
 * carries EVERY thread covering that character, as a space-separated set in
 * `data-comment-id`. That is what makes threads overlap: commenting a range that
 * already contains a thread used to overwrite it and silently orphan its notes.
 * Nesting spans instead would not survive a reload — the parser collapses two comment
 * marks on the same character back into one.
 *
 * A single id parses as a one-element set, so documents written before this change
 * load unchanged.
 */
export const CommentMark = Mark.create<CommentMarkOptions>({
  name: "comment",

  // Do not extend the mark when typing at its edges — a comment should stay scoped to
  // the range it was applied to.
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
      commentIds: {
        default: "",
        parseHTML: (el) =>
          formatCommentIds(parseCommentIds(el.getAttribute("data-comment-id"))),
        renderHTML: (attrs) =>
          attrs.commentIds ? { "data-comment-id": attrs.commentIds } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-comment-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: "hl-comment",
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setComment:
        (commentIds: string) =>
        ({ commands }) =>
          commands.setMark(this.name, { commentIds }),
      unsetComment:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});
