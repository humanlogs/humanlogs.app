import type { TranscriptionContent } from "@/hooks/use-transcriptions";
import type { ImportTurn } from "../types";
import { buildTranscriptionContent } from "../synthesize-timestamps";
import { asSpeakerId, toNum } from "./shared";

/**
 * Quote-aware CSV/TSV row tokenizer. Handles quoted fields, escaped quotes
 * (`""`), and embedded newlines. Auto-detects comma vs tab vs semicolon from
 * the first line.
 */
function parseRows(text: string): string[][] {
  const sample = text.split(/\r?\n/, 1)[0] || "";
  const delimiter =
    sample.includes("\t") && !sample.includes(",")
      ? "\t"
      : sample.split(";").length > sample.split(",").length
        ? ";"
        : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // ignore
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

/**
 * Parse CSV with speaker labels. Recognizes a header row with `speaker`/`text`
 * (and optional `start`/`end`) columns; otherwise assumes `[speaker, text]`
 * (or a single `text` column).
 */
export function parseCsv(text: string): TranscriptionContent {
  const rows = parseRows(text);
  if (rows.length === 0) throw new Error("The CSV file is empty");

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const findCol = (...names: string[]) =>
    header.findIndex((h) => names.some((n) => h === n || h.includes(n)));

  const speakerCol = findCol("speaker", "name", "interlocutor");
  const textCol = findCol("text", "content", "utterance", "transcript");
  const startCol = findCol("start", "begin", "in");
  const endCol = findCol("end", "stop", "out");

  const hasHeader = speakerCol !== -1 || textCol !== -1;
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const sCol = hasHeader ? (speakerCol === -1 ? 0 : speakerCol) : 0;
  const tCol = hasHeader
    ? textCol === -1
      ? 1
      : textCol
    : rows[0].length > 1
      ? 1
      : 0;

  const turns: ImportTurn[] = [];
  for (const r of dataRows) {
    const text = (r[tCol] ?? "").trim();
    if (!text) continue;
    const speaker =
      tCol !== sCol ? (r[sCol] ?? "").trim() || undefined : undefined;
    turns.push({
      text,
      speaker,
      start: hasHeader && startCol !== -1 ? toNum(r[startCol]) : undefined,
      end: hasHeader && endCol !== -1 ? toNum(r[endCol]) : undefined,
      speakerId: undefined,
    });
  }

  if (turns.length === 0) throw new Error("No rows with text found in the CSV");
  // Normalize numeric speaker labels to stable ids where possible.
  for (const t of turns) {
    const id = asSpeakerId(t.speaker);
    if (id && /^speaker_\d+$/.test(id)) {
      t.speakerId = id;
      t.speaker = undefined;
    }
  }
  return buildTranscriptionContent(turns);
}
