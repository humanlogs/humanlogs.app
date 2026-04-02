import { TranscriptionSegment } from "@/hooks/use-transcriptions";
import { normalizeEditorSegments } from "../hooks/use-normalize-editor-segments";

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Converts segments to plain HTML text with formatting tags.
 * No individual word spans - just the text content with b/i/u/s tags.
 * Converts newlines to <br> tags for proper display.
 */
export function segmentsToHtml(segments: TranscriptionSegment[]): string {
  let html = "";

  segments = normalizeEditorSegments(segments);

  for (const seg of segments) {
    const modifiers = seg.modifiers ?? [];
    let content = escapeHtml(seg.text);

    // Replace newlines with <br> tags
    content = content.replace(/\n/g, "<br>");

    // Apply formatting tags in consistent order
    if (modifiers.includes("b")) content = `<b>${content}</b>`;
    if (modifiers.includes("i")) content = `<i>${content}</i>`;
    if (modifiers.includes("u")) content = `<u>${content}</u>`;
    if (modifiers.includes("s")) content = `<s>${content}</s>`;

    html += content;
  }

  html = "<p>" + html.replace(/<br><br>/gm, "</p><p>") + "</p>"; // Wrap in a paragraph for better structure

  return html;
}
