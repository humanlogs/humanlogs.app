import type { TranscriptionContent } from "@/hooks/use-transcriptions";
import type { ImportTurn } from "../types";
import { buildTranscriptionContent } from "../synthesize-timestamps";
import { timeToSeconds } from "./shared";

// A time token such as 0:00:05, 00:00:05.0, or 1:23.
const TIME_TOKEN = /\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?/;

/** Parse a NVivo "Timespan" cell, which may be a single time or a range. */
function parseTimespan(cell: string): { start?: number; end?: number } {
  const matches = cell.match(new RegExp(TIME_TOKEN.source, "g"));
  if (!matches || matches.length === 0) return {};
  const start = timeToSeconds(matches[0]);
  const end = matches[1] ? timeToSeconds(matches[1]) : undefined;
  return { start, end };
}

function fromTable(rows: string[][]): ImportTurn[] {
  const header = rows[0].map((c) => c.trim().toLowerCase());
  const col = (...keys: string[]) =>
    header.findIndex((h) => keys.some((k) => h.includes(k)));

  let timeCol = col("timespan", "time");
  let speakerCol = col("speaker", "name");
  let contentCol = col("content", "transcript", "text");
  const looksHeader = timeCol !== -1 || speakerCol !== -1 || contentCol !== -1;

  // Without a header, infer columns: the one that parses as a time is the
  // timespan; the longest remaining column is the content.
  if (!looksHeader) {
    const probe = rows[0];
    timeCol = probe.findIndex((c) => TIME_TOKEN.test(c));
    contentCol = probe
      .map((c, i) => ({ i, len: c.trim().length }))
      .filter((x) => x.i !== timeCol)
      .sort((a, b) => b.len - a.len)[0]?.i;
    speakerCol = probe.findIndex((_, i) => i !== timeCol && i !== contentCol);
  }

  const dataRows = looksHeader ? rows.slice(1) : rows;
  const turns: ImportTurn[] = [];
  for (const r of dataRows) {
    const text = (contentCol != null && r[contentCol] ? r[contentCol] : "")
      .trim();
    if (!text) continue;
    const { start, end } =
      timeCol != null && timeCol !== -1 && r[timeCol]
        ? parseTimespan(r[timeCol])
        : {};
    const speaker =
      speakerCol != null && speakerCol !== -1 && r[speakerCol]
        ? r[speakerCol].trim() || undefined
        : undefined;
    turns.push({ text, speaker, start, end });
  }
  return turns;
}

function fromText(text: string): ImportTurn[] {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const turns: ImportTurn[] = [];
  for (const line of lines) {
    const timeMatch = line.match(new RegExp(TIME_TOKEN.source, "g"));
    const start = timeMatch ? timeToSeconds(timeMatch[0]) : undefined;
    const end = timeMatch && timeMatch[1] ? timeToSeconds(timeMatch[1]) : undefined;

    // Everything before the first time token may hold a speaker label; text is
    // whatever remains once time tokens are removed.
    let speaker: string | undefined;
    if (timeMatch) {
      const before = line.slice(0, line.indexOf(timeMatch[0])).trim();
      if (before && before.length <= 40) {
        speaker = before.replace(/[:\t]+$/, "").trim() || undefined;
      }
    } else {
      const m = line.match(/^([^:]{1,40}):\s+([\s\S]+)$/);
      if (m) {
        speaker = m[1].trim();
      }
    }

    const body = line
      .replace(new RegExp(TIME_TOKEN.source + "(\\s*-\\s*" + TIME_TOKEN.source + ")?", "g"), "")
      .replace(speaker ? new RegExp("^" + escapeRe(speaker) + "\\s*:?\\s*") : /^$/, "")
      .trim();

    if (body) turns.push({ text: body, speaker, start, end });
  }
  return turns;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Parse a NVivo transcript export. Prefers a table (Timespan / Speaker /
 * Content columns), falling back to line-based text parsing. Real timespans are
 * kept when present.
 */
export function parseNvivo(
  text: string,
  tableRows?: string[][],
): TranscriptionContent {
  const usable = (tableRows ?? []).filter(
    (r) => r.filter((c) => c.trim()).length >= 2,
  );
  const turns =
    usable.length >= 2 ? fromTable(tableRows as string[][]) : fromText(text);
  const cleaned = turns.filter((t) => t.text.trim());
  if (!cleaned.length) {
    throw new Error("Could not read any transcript rows from the NVivo file");
  }
  return buildTranscriptionContent(cleaned);
}
