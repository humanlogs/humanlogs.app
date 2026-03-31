import { TranscriptionSegment } from "@/hooks/use-transcriptions";

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Converts segments to plain HTML text with formatting tags.
 * No individual word spans - just the text content with b/i/u/s tags.
 */
export function segmentsToHtml(segments: TranscriptionSegment[]): string {
  let html = "";

  for (const seg of segments) {
    const modifiers = seg.modifiers ?? [];
    let content = escapeHtml(seg.text);

    // Apply formatting tags in consistent order
    if (modifiers.includes("b")) content = `<b>${content}</b>`;
    if (modifiers.includes("i")) content = `<i>${content}</i>`;
    if (modifiers.includes("u")) content = `<u>${content}</u>`;
    if (modifiers.includes("s")) content = `<s>${content}</s>`;

    html += content;
  }

  return html;
}
