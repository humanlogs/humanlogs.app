import { TranscriptionSegment } from "../../../../hooks/use-api";

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function segmentToHtml(
  seg: TranscriptionSegment,
  index: number,
): string {
  const modifiers = seg.modifiers ?? [];
  let content = escapeHtml(seg.text);
  if (modifiers.includes("u")) content = `<u>${content}</u>`;
  if (modifiers.includes("i")) content = `<i>${content}</i>`;
  if (modifiers.includes("b")) content = `<b>${content}</b>`;

  const cls = seg.type === "word" ? "word-span" : "spacing-span";
  const dataStart = seg.start !== undefined ? ` data-start="${seg.start}"` : "";
  const dataEnd = seg.end !== undefined ? ` data-end="${seg.end}"` : "";
  const dataSpeaker = seg.speakerId ? ` data-speaker="${seg.speakerId}"` : "";

  return `<span class="${cls}" data-index="${index}" data-type="${seg.type}"${dataStart}${dataEnd}${dataSpeaker}>${content}</span>`;
}

export function segmentsToHtml(segments: TranscriptionSegment[]): string {
  return segments.map((seg, i) => segmentToHtml(seg, i)).join("");
}
