import type { TranscriptionContent } from "@/hooks/use-transcriptions";
import { parseSRT } from "@/lib/utils/srt-parser";
import type { ImportTurn } from "../types";
import { buildTranscriptionContent } from "../synthesize-timestamps";
import { timeToSeconds } from "./shared";

/**
 * Pull a speaker out of a cue: a WebVTT voice tag (`<v Name>...`) or a leading
 * `Name:` prefix. Strips any remaining markup and collapses newlines.
 */
function extractSpeaker(raw: string): { speaker?: string; text: string } {
  const voice = raw.match(/<v\s+([^>]+)>/i);
  let speaker = voice ? voice[1].trim() : undefined;
  let text = raw.replace(/<[^>]+>/g, "").trim();

  if (!speaker) {
    const m = text.match(/^([^:\n]{1,40}):\s+([\s\S]+)$/);
    if (m && /^[\p{L}0-9 ._'\-]+$/u.test(m[1].trim())) {
      speaker = m[1].trim();
      text = m[2].trim();
    }
  }
  return { speaker, text: text.replace(/\s*\n\s*/g, " ").trim() };
}

/** Parse SRT subtitles (real timestamps preserved). */
export function parseSrt(content: string): TranscriptionContent {
  const cues = parseSRT(content);
  if (!cues.length) throw new Error("No subtitles found in the SRT file");
  const turns: ImportTurn[] = cues
    .map((c) => {
      const { speaker, text } = extractSpeaker(c.text);
      return { speaker, text, start: c.startMs / 1000, end: c.endMs / 1000 };
    })
    .filter((t) => t.text);
  if (!turns.length) throw new Error("No subtitle text found");
  return buildTranscriptionContent(turns);
}

/** Parse WebVTT subtitles (real timestamps preserved). */
export function parseVtt(content: string): TranscriptionContent {
  const body = content.replace(/^﻿/, "");
  const blocks = body.split(/\r?\n\s*\r?\n/);
  const turns: ImportTurn[] = [];

  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    const idx = lines.findIndex((l) => l.includes("-->"));
    if (idx === -1) continue;
    const m = lines[idx].match(/([\d:.,]+)\s*-->\s*([\d:.,]+)/);
    if (!m) continue;
    const start = timeToSeconds(m[1]);
    const end = timeToSeconds(m[2]);
    if (start === undefined || end === undefined) continue;
    const raw = lines.slice(idx + 1).join("\n").trim();
    if (!raw) continue;
    const { speaker, text } = extractSpeaker(raw);
    if (text) turns.push({ speaker, text, start, end });
  }

  if (!turns.length) throw new Error("No cues found in the WebVTT file");
  return buildTranscriptionContent(turns);
}
