import type { TranscriptionContent } from "@/hooks/use-transcriptions";
import { parseCsv } from "./parsers/csv";
import { extractDocx, parseDocx } from "./parsers/docx";
import { parseJson } from "./parsers/json";
import { parseMaxqda } from "./parsers/maxqda";
import { parseNvivo } from "./parsers/nvivo";
import { parseSrt, parseVtt } from "./parsers/subtitles";
import { parseTxt } from "./parsers/txt";
import type { ImportFormat } from "./types";

export * from "./types";

function extension(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i === -1 ? "" : filename.slice(i).toLowerCase();
}

/** True if the bytes are a ZIP container (all .docx files are ZIPs). */
function isZip(buffer: Buffer): boolean {
  return buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

/** Infer the import format from the filename, falling back to content sniffing. */
export function detectFormat(filename: string, buffer: Buffer): ImportFormat {
  switch (extension(filename)) {
    case ".json":
      return "json";
    case ".csv":
    case ".tsv":
      return "csv";
    case ".srt":
      return "srt";
    case ".vtt":
      return "vtt";
    case ".docx":
      return "docx";
    case ".txt":
      break;
  }

  if (isZip(buffer)) return "docx";

  const sample = buffer.subarray(0, 4096).toString("utf8").trimStart();
  if (/^WEBVTT/.test(sample)) return "vtt";
  if (/\d{2}:\d{2}:\d{2},\d{3}\s*-->/.test(sample)) return "srt";
  if (/#\d{1,2}:\d{2}(?::\d{2})?[.\-]?\d*#/.test(sample)) return "maxqda";
  if (sample.startsWith("{") || sample.startsWith("[")) {
    try {
      JSON.parse(buffer.toString("utf8"));
      return "json";
    } catch {
      // not JSON
    }
  }
  return "txt";
}

export interface ParsedImport {
  content: TranscriptionContent;
  format: ImportFormat;
}

/**
 * Parse an imported document into editor-ready `TranscriptionContent`. Every
 * word receives an individual start/end timestamp (real when the source has
 * timing, synthesized at a reading cadence otherwise).
 */
export async function parseImport(
  buffer: Buffer,
  filename: string,
  requested?: ImportFormat | "auto",
): Promise<ParsedImport> {
  const format =
    requested && requested !== "auto"
      ? requested
      : detectFormat(filename, buffer);

  const asText = () => buffer.toString("utf8");

  let content: TranscriptionContent;
  switch (format) {
    case "json":
      content = parseJson(asText());
      break;
    case "csv":
      content = parseCsv(asText());
      break;
    case "txt":
      content = parseTxt(asText());
      break;
    case "srt":
      content = parseSrt(asText());
      break;
    case "vtt":
      content = parseVtt(asText());
      break;
    case "docx":
      content = await parseDocx(buffer);
      break;
    case "nvivo":
      if (isZip(buffer)) {
        const doc = await extractDocx(buffer);
        content = parseNvivo(doc.fullText, doc.tableRows);
      } else {
        content = parseNvivo(asText());
      }
      break;
    case "maxqda":
      content = isZip(buffer)
        ? parseMaxqda((await extractDocx(buffer)).fullText)
        : parseMaxqda(asText());
      break;
    default:
      content = parseTxt(asText());
  }

  return { content, format };
}
