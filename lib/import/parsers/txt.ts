import type { TranscriptionContent } from "@/hooks/use-transcriptions";
import type { ImportTurn } from "../types";
import { buildTranscriptionContent } from "../synthesize-timestamps";

/**
 * Parse plain text into a transcript. Blank-line-separated blocks become
 * paragraphs (turns); single newlines within a block are kept as spaces. No
 * speaker detection — plain text is treated as one unlabeled speaker.
 */
export function parseTxt(text: string): TranscriptionContent {
  const blocks = text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((b) => b.replace(/\n/g, " ").trim())
    .filter(Boolean);

  const source = blocks.length ? blocks : [text.replace(/\s+/g, " ").trim()];
  const turns: ImportTurn[] = source
    .filter(Boolean)
    .map((t) => ({ text: t }));

  if (turns.length === 0) throw new Error("The document has no readable text");
  return buildTranscriptionContent(turns);
}
