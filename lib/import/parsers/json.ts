import type {
  TranscriptionContent,
  TranscriptionSegment,
} from "@/hooks/use-transcriptions";
import type { ImportTurn } from "../types";
import { buildTranscriptionContent } from "../synthesize-timestamps";
import { asSpeakerId, toNum } from "./shared";

/**
 * Parse a JSON transcript. Handles three shapes:
 *  - our own `TranscriptionContent`/provider `TranscriptionResult` with a
 *    word-level `words` array (per-word timing is preserved when present);
 *  - an array (or `{ turns: [...] }`) of speaker turns;
 *  - a plain `{ text: "..." }`.
 */
export function parseJson(text: string): TranscriptionContent {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON file");
  }

  // Unwrap a `{ transcription: {...} }` envelope (e.g. a full record export).
  const obj = data as Record<string, unknown>;
  if (
    obj &&
    typeof obj === "object" &&
    obj.transcription &&
    typeof obj.transcription === "object"
  ) {
    data = obj.transcription;
  }

  const root = data as Record<string, unknown>;

  // Case A — word-level content.
  const words = Array.isArray(root?.words)
    ? (root.words as Record<string, unknown>[])
    : null;
  if (words && looksWordLevel(words)) {
    return buildFromWordLevel(words, root?.speakers);
  }

  // Case B — an array / `{ turns }` of speaker turns.
  const rawTurns = Array.isArray(data)
    ? (data as Record<string, unknown>[])
    : Array.isArray(root?.turns)
      ? (root.turns as Record<string, unknown>[])
      : null;
  if (rawTurns) {
    const turns = rawTurns.map(normalizeTurn).filter((t) => t.text.trim());
    if (turns.length) return buildTranscriptionContent(turns);
  }

  // Case C — a single text blob.
  if (typeof root?.text === "string" && root.text.trim()) {
    return buildTranscriptionContent([{ text: root.text }]);
  }

  throw new Error("Unrecognized JSON transcript structure");
}

function looksWordLevel(words: Record<string, unknown>[]): boolean {
  if (words.length === 0) return false;
  const sample = words.slice(0, 20);
  const withText = sample.filter(
    (w) => typeof w.text === "string" || typeof w.word === "string",
  );
  return withText.length >= Math.min(sample.length, 3);
}

function normalizeTurn(t: Record<string, unknown>): ImportTurn {
  const text =
    typeof t.text === "string"
      ? t.text
      : typeof t.content === "string"
        ? t.content
        : "";
  return {
    text,
    speaker:
      (typeof t.speaker === "string" && t.speaker) ||
      (typeof t.speakerName === "string" && t.speakerName) ||
      undefined,
    speakerId: asSpeakerId(t.speakerId ?? t.speaker_id),
    start: toNum(t.start),
    end: toNum(t.end),
  };
}

/**
 * Build content directly from a word-level array, preserving per-word timing
 * when every word carries it; otherwise fall back to synthesis via turns so
 * every word still ends up with a start/end.
 */
function buildFromWordLevel(
  words: Record<string, unknown>[],
  speakersInput: unknown,
): TranscriptionContent {
  const normalized = words
    .map((w) => ({
      text: String((w.text ?? w.word ?? "") as string),
      type: w.type === "spacing" ? ("spacing" as const) : ("word" as const),
      speakerId: asSpeakerId(w.speakerId ?? w.speaker_id ?? w.speaker),
      start: toNum(w.start),
      end: toNum(w.end),
    }))
    .filter((w) => w.text.length > 0);

  const wordEntries = normalized.filter((w) => w.type === "word");
  const allTimed =
    wordEntries.length > 0 &&
    wordEntries.every((w) => w.start !== undefined && w.end !== undefined);

  if (!allTimed) {
    // Missing timing → regroup into turns and synthesize timestamps.
    const turns: ImportTurn[] = [];
    let current: ImportTurn | null = null;
    for (const w of normalized) {
      if (w.type === "spacing") {
        if (current) current.text += w.text.includes("\n") ? "\n" : " ";
        continue;
      }
      if (!current || current.speakerId !== w.speakerId) {
        current = { text: "", speakerId: w.speakerId };
        turns.push(current);
      }
      current.text += (current.text ? " " : "") + w.text;
    }
    return buildTranscriptionContent(turns.filter((t) => t.text.trim()));
  }

  // Preserve per-word timing; ensure a spacing sits between adjacent words.
  const segments: TranscriptionSegment[] = [];
  const speakerIds = new Set<string>();
  for (const w of normalized) {
    if (w.speakerId) speakerIds.add(w.speakerId);
    const prev = segments[segments.length - 1];
    if (w.type === "word" && prev && prev.type === "word") {
      segments.push({
        type: "spacing",
        text: " ",
        speakerId: prev.speakerId,
        start: prev.end,
        end: w.start,
      });
    }
    segments.push({
      type: w.type,
      text: w.text,
      speakerId: w.speakerId,
      ...(w.start !== undefined ? { start: w.start } : {}),
      ...(w.end !== undefined ? { end: w.end } : {}),
    });
  }

  const speakers = resolveSpeakers(speakersInput, speakerIds);
  return { speakers, words: segments };
}

function resolveSpeakers(
  speakersInput: unknown,
  seenIds: Set<string>,
): { id: string; name?: string }[] {
  const provided = Array.isArray(speakersInput)
    ? (speakersInput as Record<string, unknown>[])
        .map((s) => ({
          id: asSpeakerId(s.id) ?? String(s.id ?? ""),
          name:
            typeof s.name === "string" && s.name.trim()
              ? s.name.trim()
              : undefined,
        }))
        .filter((s) => s.id)
    : [];
  const byId = new Map(provided.map((s) => [s.id, s]));
  for (const id of seenIds) {
    if (!byId.has(id)) byId.set(id, { id, name: undefined });
  }
  const list = Array.from(byId.values());
  return list.length ? list : [{ id: "speaker_0" }];
}
