import type { TranscriptionContent } from "@/hooks/use-transcriptions";
import type { ImportTurn } from "../types";
import { buildTranscriptionContent } from "../synthesize-timestamps";
import { timeToSeconds } from "./shared";

// MAXQDA inline timestamp marker, e.g. #00:01:23-4# (the trailing -N is a
// fractional/frame index we ignore).
const MARKER = /#(\d{1,2}:\d{2}(?::\d{2})?)(?:[.\-]\d+)?#/;
const MARKER_G = new RegExp(MARKER.source, "g");

/**
 * Parse a MAXQDA transcript export. Speaker turns are `Name:` prefixed lines /
 * paragraphs; inline `#hh:mm:ss-f#` markers give real timing. The first marker
 * in a turn is its start; the next turn's first marker (or synthesis) bounds it.
 */
export function parseMaxqda(text: string): TranscriptionContent {
  const blocks = text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .flatMap((b) => (b.includes("\n") ? b.split("\n") : [b]))
    .map((l) => l.trim())
    .filter(Boolean);

  const turns: ImportTurn[] = [];
  for (const line of blocks) {
    // Extract the first timestamp marker as the turn start.
    const markerMatch = line.match(MARKER);
    const start = markerMatch ? timeToSeconds(markerMatch[1]) : undefined;

    // Strip all markers from the visible text.
    let body = line.replace(MARKER_G, " ").replace(/\s+/g, " ").trim();

    // Leading "Speaker:" label.
    let speaker: string | undefined;
    const m = body.match(/^([^:]{1,40}):\s+([\s\S]+)$/);
    if (m && /^[\p{L}0-9 ._'\-]+$/u.test(m[1].trim())) {
      speaker = m[1].trim();
      body = m[2].trim();
    }

    if (body) turns.push({ text: body, speaker, start });
  }

  if (!turns.length) {
    throw new Error("Could not read any transcript text from the MAXQDA file");
  }

  // Fill each timed turn's end from the next timed turn's start so real markers
  // define real spans (synthesis covers the rest).
  for (let i = 0; i < turns.length; i++) {
    if (turns[i].start === undefined) continue;
    if (turns[i].end !== undefined) continue;
    const next = turns.slice(i + 1).find((t) => t.start !== undefined);
    if (next && (next.start as number) > (turns[i].start as number)) {
      turns[i].end = next.start;
    }
  }

  return buildTranscriptionContent(turns);
}
