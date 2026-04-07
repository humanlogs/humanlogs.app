import { TranscriptionSegment } from "@/hooks/use-transcriptions";
import { normalizeEditorSegments } from "../hooks/use-normalize-editor-segments";

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/ /g, "&nbsp;");
}

/**
 * Converts segments to plain HTML text with formatting tags.
 * No individual word spans - just the text content with b/i/u/s tags.
 * Converts newlines to <br> tags for proper display.
 * Tags are kept open across segments until modifiers change, respecting proper nesting hierarchy.
 */
export function segmentsToHtml(segments: TranscriptionSegment[]): string {
  if (!segments.length) {
    return "<p></p>";
  }

  let html = "";
  let currentModifiers: string[] = []; // Track currently open tags in order

  segments = normalizeEditorSegments(segments);

  // Define consistent order for modifiers to ensure proper nesting
  const modifierOrder = ["b", "i", "u", "s"];

  for (let j = 0; j < segments.length; j++) {
    const nextSegment = segments[j + 1];
    const seg = segments[j];

    // Get segment modifiers sorted in consistent order
    const newModifiers = (seg.modifiers ?? [])
      .filter((m) => modifierOrder.includes(m))
      .sort((a, b) => modifierOrder.indexOf(a) - modifierOrder.indexOf(b));

    // Find where the modifier stacks diverge
    let commonLength = 0;
    while (
      commonLength < currentModifiers.length &&
      commonLength < newModifiers.length &&
      currentModifiers[commonLength] === newModifiers[commonLength]
    ) {
      commonLength++;
    }

    // Close tags that are no longer needed (in reverse order to respect nesting)
    for (let i = currentModifiers.length - 1; i >= commonLength; i--) {
      html += `</${currentModifiers[i]}>`;
    }

    // Open new tags
    for (let i = commonLength; i < newModifiers.length; i++) {
      html += `<${newModifiers[i]}>`;
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
      for (let i = currentModifiers.length - 1; i >= 0; i--) {
        html += `</${currentModifiers[i]}>`;
      }
      currentModifiers = [];
      html += `</p><p data-speaker-id="${nextSegment.speakerId}">`; // Start new paragraph for new speaker
    } else {
      // Add content
      let content = escapeHtml(seg.text);
      content = content.replace(/\n/g, "<br>");
      html += content;

      currentModifiers = newModifiers;
    }
  }

  // Close any remaining open tags (in reverse order)
  for (let i = currentModifiers.length - 1; i >= 0; i--) {
    html += `</${currentModifiers[i]}>`;
  }

  html = `<p data-speaker-id="${segments[0].speakerId}">${html}</p>`; // Wrap in a paragraph for better structure

  // Fix &nbsp; between words to normal space for better copy-paste
  // Also for break points
  html = html.replace(/([a-zA-Z1-9])&nbsp;([a-zA-Z1-9])/g, "$1 $2");

  return html;
}
