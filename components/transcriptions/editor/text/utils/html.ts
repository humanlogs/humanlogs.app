import { TranscriptionSegment } from "@/hooks/use-transcriptions";
import { normalizeEditorSegments } from "../hooks/use-normalize-editor-segments";
import { formatCommentIds } from "../extensions/comment-mark";

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/ /g, "&nbsp;");
}

/** Escape a value for use inside a double-quoted HTML attribute. */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Re-attach a thread to the whitespace sitting inside its range.
 *
 * The flat projection used to carry `comments` on word tokens only, so a range that had
 * been saved and reloaded came back as one highlight per word with a gap at every
 * space. A spacing segment flanked by two segments of the same thread is inside that
 * thread's range, so it inherits it. Whitespace at the edges of a range keeps no
 * thread, and a line/paragraph break is never bridged — two threads on consecutive
 * lines must not merge into one band.
 */
function bridgeCommentSpacing(
  segments: TranscriptionSegment[],
): TranscriptionSegment[] {
  return segments.map((seg, i) => {
    if (seg.type !== "spacing" || seg.comments?.length) return seg;
    if (seg.text.includes("\n")) return seg;
    const before = segments[i - 1]?.comments;
    const after = segments[i + 1]?.comments;
    if (!before?.length || !after?.length) return seg;
    const shared = before.filter((id) => after.includes(id));
    return shared.length ? { ...seg, comments: shared } : seg;
  });
}

/**
 * Converts segments to plain HTML text with formatting tags.
 * No individual word spans - just the text content with b/i/u/s tags.
 * Converts newlines to <br> tags for proper display.
 * Tags are kept open across segments until modifiers change, respecting proper nesting hierarchy.
 */
export function segmentsToHtml(
  segments: TranscriptionSegment[],
  options?: { initialFormatting?: boolean },
): string {
  if (!segments.length) {
    return "<p></p>";
  }

  let html = "";
  // Track currently open tags, outermost → innermost. Entries are either a format
  // key ("b"|"i"|"u"|"s") or a comment span encoded as `comment:<threadId>`.
  let currentTags: string[] = [];

  segments = bridgeCommentSpacing(normalizeEditorSegments(segments, options));

  // Define consistent order for modifiers to ensure proper nesting
  const modifierOrder = ["b", "i", "u", "s"];

  // Comment spans nest INSIDE the format tags (innermost) so a comment can start /
  // end independently of bold/italic without breaking tag nesting.
  //
  // All the threads covering a token go into ONE span, never nested spans: the parser
  // keeps a single `comment` mark per character, so a nested pair would come back as
  // one thread and the other would be lost on reload.
  const tagsForSegment = (seg: TranscriptionSegment): string[] => {
    const mods = (seg.modifiers ?? [])
      .filter((m) => modifierOrder.includes(m))
      .sort((a, b) => modifierOrder.indexOf(a) - modifierOrder.indexOf(b));
    const comments = seg.comments?.length
      ? [`comment:${formatCommentIds(seg.comments)}`]
      : [];
    return [...mods, ...comments];
  };

  const openTag = (tag: string): string => {
    if (tag.startsWith("comment:")) {
      const id = tag.slice("comment:".length);
      return `<span data-comment-id="${escapeAttr(id)}">`;
    }
    return `<${tag}>`;
  };
  const closeTag = (tag: string): string =>
    tag.startsWith("comment:") ? "</span>" : `</${tag}>`;

  for (let j = 0; j < segments.length; j++) {
    const nextSegment = segments[j + 1];
    const seg = segments[j];

    // Get the desired open-tag stack for this segment (formats then comment spans)
    const newTags = tagsForSegment(seg);

    // Find where the tag stacks diverge
    let commonLength = 0;
    while (
      commonLength < currentTags.length &&
      commonLength < newTags.length &&
      currentTags[commonLength] === newTags[commonLength]
    ) {
      commonLength++;
    }

    // Close tags that are no longer needed (in reverse order to respect nesting)
    for (let i = currentTags.length - 1; i >= commonLength; i--) {
      html += closeTag(currentTags[i]);
    }

    // Open new tags
    for (let i = commonLength; i < newTags.length; i++) {
      html += openTag(newTags[i]);
    }

    // What is open is now exactly `newTags`. Track it here rather than only in the
    // else-branch below: the paragraph-break branch closes `currentTags`, and if that
    // still held the *previous* segment's stack it emitted a second, unmatched closing
    // tag (`<b>fin</b></b>`) for any run ending on a speaker change.
    currentTags = newTags;

    if (
      (nextSegment && nextSegment.speakerId !== seg.speakerId) ||
      seg.text.includes("\n\n")
    ) {
      // <p></p> count as 2 characters in tiptap, it must be removed from the previous or next segment
      // Good news: all change of speaker always have a spacing forced

      // Remove in priority the \n then spaces, must remove 2 characters at least
      if (seg.text.includes("\n\n")) {
        seg.text = seg.text.replace("\n\n", "");
      } else {
        seg.text = seg.text.slice(0, -2);
      }

      let content = escapeHtml(seg.text);
      content = content.replace(/\n/g, "<br>");
      html += content;

      // Close any remaining open tags (in reverse order)
      for (let i = currentTags.length - 1; i >= 0; i--) {
        html += closeTag(currentTags[i]);
      }
      currentTags = [];
      html += `</p><p data-speaker-id="${nextSegment?.speakerId || "speaker_0"}">`; // Start new paragraph for new speaker
    } else {
      // Add content
      let content = escapeHtml(seg.text);
      content = content.replace(/\n/g, "<br>");
      html += content;
    }
  }

  // Close any remaining open tags (in reverse order)
  for (let i = currentTags.length - 1; i >= 0; i--) {
    html += closeTag(currentTags[i]);
  }

  html = `<p data-speaker-id="${segments[0].speakerId}">${html}</p>`; // Wrap in a paragraph for better structure

  // Fix &nbsp; between words to normal space for better copy-paste
  // Also for break points
  html = html.replace(/([a-zA-Z1-9])&nbsp;([a-zA-Z1-9])/g, "$1 $2");

  return html;
}
