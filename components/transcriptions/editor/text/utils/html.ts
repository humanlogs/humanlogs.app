import { TranscriptionSegment } from "@/hooks/use-transcriptions";
import { normalizeEditorSegments } from "../hooks/use-normalize-editor-segments";

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

  segments = normalizeEditorSegments(segments, options);

  // Define consistent order for modifiers to ensure proper nesting
  const modifierOrder = ["b", "i", "u", "s"];

  // Comment spans nest INSIDE the format tags (innermost) so a comment can start /
  // end independently of bold/italic without breaking tag nesting.
  const tagsForSegment = (seg: TranscriptionSegment): string[] => {
    const mods = (seg.modifiers ?? [])
      .filter((m) => modifierOrder.includes(m))
      .sort((a, b) => modifierOrder.indexOf(a) - modifierOrder.indexOf(b));
    const comments = (seg.comments ?? []).map((id) => `comment:${id}`);
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

      currentTags = newTags;
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
