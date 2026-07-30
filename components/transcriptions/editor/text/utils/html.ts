import { TranscriptionSegment } from "@/hooks/use-transcriptions";
import { normalizeEditorSegments } from "../hooks/use-normalize-editor-segments";
import { formatCommentIds } from "../extensions/comment-mark";
import { formatCodingIds } from "../extensions/coding-mark";

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
 * Re-attach an anchored range (a comment thread, a coding) to the whitespace sitting
 * inside it.
 *
 * The flat projection used to carry these ids on word tokens only, so a range that had
 * been saved and reloaded came back as one highlight per word with a gap at every
 * space. A spacing segment flanked by two segments sharing an id is inside that range,
 * so it inherits it. Whitespace at the edges keeps nothing, and a line/paragraph break
 * is never bridged — two ranges on consecutive lines must not merge into one band.
 */
function bridgeAnchorSpacing(
  segments: TranscriptionSegment[],
  field: "comments" | "codings",
): TranscriptionSegment[] {
  return segments.map((seg, i) => {
    if (seg.type !== "spacing" || seg[field]?.length) return seg;
    if (seg.text.includes("\n")) return seg;
    const before = segments[i - 1]?.[field];
    const after = segments[i + 1]?.[field];
    if (!before?.length || !after?.length) return seg;
    const shared = before.filter((id) => after.includes(id));
    return shared.length ? { ...seg, [field]: shared } : seg;
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

  segments = bridgeAnchorSpacing(
    bridgeAnchorSpacing(normalizeEditorSegments(segments, options), "comments"),
    "codings",
  );

  // Define consistent order for modifiers to ensure proper nesting
  const modifierOrder = ["b", "i", "u", "s"];

  // Anchor spans nest INSIDE the format tags (innermost) so a comment or a coding can
  // start / end independently of bold/italic without breaking tag nesting. Codings sit
  // inside comments — an arbitrary but FIXED order, which is all that matters: the two
  // stacks must never interleave, or the tags would not nest.
  //
  // All the threads covering a token go into ONE span, never nested spans: the parser
  // keeps a single `comment` mark per character, so a nested pair would come back as
  // one thread and the other would be lost on reload. Same for codings.
  const tagsForSegment = (seg: TranscriptionSegment): string[] => {
    const mods = (seg.modifiers ?? [])
      .filter((m) => modifierOrder.includes(m))
      .sort((a, b) => modifierOrder.indexOf(a) - modifierOrder.indexOf(b));
    const comments = seg.comments?.length
      ? [`comment:${formatCommentIds(seg.comments)}`]
      : [];
    const codings = seg.codings?.length
      ? [`coding:${formatCodingIds(seg.codings)}`]
      : [];
    return [...mods, ...comments, ...codings];
  };

  const openTag = (tag: string): string => {
    if (tag.startsWith("comment:")) {
      const id = tag.slice("comment:".length);
      return `<span data-comment-id="${escapeAttr(id)}">`;
    }
    if (tag.startsWith("coding:")) {
      const id = tag.slice("coding:".length);
      return `<span data-coding-id="${escapeAttr(id)}">`;
    }
    return `<${tag}>`;
  };
  const closeTag = (tag: string): string =>
    tag.startsWith("comment:") || tag.startsWith("coding:")
      ? "</span>"
      : `</${tag}>`;

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
