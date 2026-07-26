import { Mark, mergeAttributes } from "@tiptap/core";

export interface CommentMarkOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    comment: {
      /** Mark the current selection as belonging to comment thread `commentId`. */
      setComment: (commentId: string) => ReturnType;
      /** Remove the comment mark from the current selection. */
      unsetComment: () => ReturnType;
    };
  }
}

/**
 * Inline mark anchoring a comment thread to a range of transcript text.
 *
 * The mark only carries the thread id (`commentId`); the note bodies live in the
 * `Comment` table (encrypted, versioned, multi-user). Because it is a normal mark it
 * moves with the text through ProseMirror mapping + the Yjs CRDT, and it round-trips
 * through the flat segment projection via the `comments` field (see doc-to-segments.ts
 * and utils/html.ts) so anchors are versioned with the transcript and survive reseed.
 *
 * A mark type can only appear once per position, so a given character belongs to at
 * most one thread — overlapping threads on the exact same character are not supported,
 * which is an accepted limitation.
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
      commentId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-comment-id"),
        renderHTML: (attrs) =>
          attrs.commentId ? { "data-comment-id": attrs.commentId } : {},
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
        (commentId: string) =>
        ({ commands }) =>
          commands.setMark(this.name, { commentId }),
      unsetComment:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});
