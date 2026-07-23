import type { TranscriptionContent } from "@/hooks/use-transcriptions";
import JSZip from "jszip";
import type { ImportTurn } from "../types";
import { buildTranscriptionContent } from "../synthesize-timestamps";

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) =>
      String.fromCodePoint(parseInt(h, 16)),
    )
    .replace(/&amp;/g, "&");
}

/** Concatenate the visible text of a run fragment, honoring tabs and breaks. */
function runText(fragment: string): string {
  let out = "";
  const tokenRe =
    /<w:tab\b[^>]*\/>|<w:br\b[^>]*\/?>|<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(fragment))) {
    if (m[0].startsWith("<w:tab")) out += "\t";
    else if (m[0].startsWith("<w:br")) out += "\n";
    else out += decodeXml(m[1] ?? "");
  }
  return out;
}

function paragraphsOf(fragment: string): string[] {
  const paras: string[] = [];
  const pRe = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  let m: RegExpExecArray | null;
  while ((m = pRe.exec(fragment))) {
    paras.push(runText(m[1]).trim());
  }
  return paras;
}

export interface DocxContent {
  paragraphs: string[];
  tableRows: string[][];
  fullText: string;
}

/** Extract paragraphs and table rows from a .docx buffer (no external deps). */
export async function extractDocx(buffer: Buffer): Promise<DocxContent> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error("Not a valid .docx file");
  }
  const file = zip.file("word/document.xml");
  if (!file) throw new Error("Not a valid .docx file");
  const xml = await file.async("string");

  const tableRows: string[][] = [];
  const tblRe = /<w:tbl\b[^>]*>([\s\S]*?)<\/w:tbl>/g;
  let tm: RegExpExecArray | null;
  while ((tm = tblRe.exec(xml))) {
    const trRe = /<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g;
    let rm: RegExpExecArray | null;
    while ((rm = trRe.exec(tm[1]))) {
      const cells: string[] = [];
      const tcRe = /<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g;
      let cm: RegExpExecArray | null;
      while ((cm = tcRe.exec(rm[1]))) {
        cells.push(paragraphsOf(cm[1]).join("\n").trim());
      }
      if (cells.some((c) => c.trim())) tableRows.push(cells);
    }
  }

  const paragraphs = paragraphsOf(xml).filter(Boolean);
  return { paragraphs, tableRows, fullText: paragraphs.join("\n\n") };
}

/**
 * Parse a generic .docx. If the document is primarily a 2+ column table it is
 * read as `[speaker, text]` turns; otherwise paragraphs become turns.
 */
export async function parseDocx(buffer: Buffer): Promise<TranscriptionContent> {
  const { paragraphs, tableRows } = await extractDocx(buffer);

  const usableRows = tableRows.filter(
    (r) => r.filter((c) => c.trim()).length >= 2,
  );
  if (usableRows.length >= 2) {
    const turns = tableRowsToTurns(tableRows);
    if (turns.length) return buildTranscriptionContent(turns);
  }

  if (paragraphs.length === 0) {
    throw new Error("The document has no readable text");
  }
  return buildTranscriptionContent(paragraphs.map((t) => ({ text: t })));
}

function tableRowsToTurns(rows: string[][]): ImportTurn[] {
  // Skip a header row when the first row looks like column labels.
  const first = rows[0].map((c) => c.trim().toLowerCase());
  const looksHeader = first.some((c) =>
    ["speaker", "text", "content", "name"].some((k) => c === k),
  );
  const dataRows = looksHeader ? rows.slice(1) : rows;

  const turns: ImportTurn[] = [];
  for (const r of dataRows) {
    const cells = r.map((c) => c.trim());
    if (cells.length === 1) {
      if (cells[0]) turns.push({ text: cells[0] });
      continue;
    }
    const speaker = cells[0] || undefined;
    const text = cells.slice(1).filter(Boolean).join(" ").trim();
    if (text) turns.push({ speaker, text });
  }
  return turns;
}
