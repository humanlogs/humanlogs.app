import type {
  TranscriptionContent,
  TranscriptionSegment,
} from "@/hooks/use-transcriptions";
import type { ImportTurn } from "./types";

// Reading cadence used to synthesize timing when the source has no real
// timestamps. ~150 words/min ≈ 2.5 words/s. Assuming an average word+space of
// ~6 characters, that is ~0.0667s per character.
const SECONDS_PER_CHAR = 0.0667;
const MIN_WORD_DURATION = 0.15;
const SPACE_GAP = 0.04;

const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Build the editor's `TranscriptionContent` from parsed speaker turns, assigning
 * every word an individual start/end timestamp — as if it had come from audio —
 * so click-to-seek, playback highlighting and navigation all work.
 *
 * Turns that already carry real `start`/`end` keep that timing (distributed
 * across their words proportionally to word length); turns without timing get
 * synthetic timing at a natural reading cadence, continuing from the running
 * clock so the whole document has a coherent, monotonic timeline.
 */
export function buildTranscriptionContent(
  turns: ImportTurn[],
): TranscriptionContent {
  const words: TranscriptionSegment[] = [];

  // Resolve speakers to stable ids while preserving the encounter order and any
  // display names the source provided.
  const speakerIdByKey = new Map<string, string>();
  const speakerNameById = new Map<string, string | undefined>();
  let generatedSpeakerCount = 0;

  const resolveSpeakerId = (turn: ImportTurn): string => {
    if (turn.speakerId) {
      if (!speakerNameById.has(turn.speakerId)) {
        speakerNameById.set(turn.speakerId, turn.speaker?.trim() || undefined);
      } else if (turn.speaker?.trim() && !speakerNameById.get(turn.speakerId)) {
        speakerNameById.set(turn.speakerId, turn.speaker.trim());
      }
      return turn.speakerId;
    }
    const name = turn.speaker?.trim();
    const key = name ? `name:${name.toLowerCase()}` : "__default__";
    let id = speakerIdByKey.get(key);
    if (!id) {
      id = `speaker_${generatedSpeakerCount++}`;
      speakerIdByKey.set(key, id);
      speakerNameById.set(id, name || undefined);
    }
    return id;
  };

  let clock = 0;

  const cleaned = turns.filter((t) => t.text.split(/\s+/).some(Boolean));

  for (let ti = 0; ti < cleaned.length; ti++) {
    const turn = cleaned[ti];
    const isLastTurn = ti === cleaned.length - 1;
    const tokens = turn.text.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;

    const speakerId = resolveSpeakerId(turn);

    const hasReal =
      typeof turn.start === "number" &&
      typeof turn.end === "number" &&
      turn.end > turn.start;

    const totalChars = tokens.reduce((sum, t) => sum + t.length, 0) || 1;
    const realDuration = hasReal ? (turn.end as number) - (turn.start as number) : 0;

    // Start real turns at their real start (never rewinding the clock); synthetic
    // turns continue from wherever the timeline currently is.
    let cursor = hasReal ? Math.max(clock, turn.start as number) : clock;

    tokens.forEach((token, i) => {
      const duration = hasReal
        ? realDuration * (token.length / totalChars)
        : Math.max(MIN_WORD_DURATION, token.length * SECONDS_PER_CHAR);

      const wordStart = cursor;
      const wordEnd = cursor + duration;
      words.push({
        type: "word",
        text: token,
        start: round(wordStart),
        end: round(wordEnd),
        speakerId,
      });
      cursor = wordEnd;

      // A spacing segment always follows a word (including the last word of a
      // turn) so consecutive speakers are separated, as the editor requires.
      const gap = hasReal ? 0 : SPACE_GAP;
      const spaceEnd = cursor + gap;
      const isLastWord = i === tokens.length - 1;
      // Between turns: a paragraph break. Within a turn / after the final word:
      // a plain space.
      const spacingText = isLastWord && !isLastTurn ? "\n\n" : " ";
      words.push({
        type: "spacing",
        text: spacingText,
        start: round(cursor),
        end: round(spaceEnd),
        speakerId,
      });
      cursor = spaceEnd;
    });

    clock = hasReal ? Math.max(clock, turn.end as number) : cursor;
  }

  const speakers = Array.from(speakerNameById.entries()).map(([id, name]) => ({
    id,
    ...(name ? { name } : {}),
  }));

  // Guarantee at least one speaker so the editor always has a paragraph owner.
  if (speakers.length === 0) speakers.push({ id: "speaker_0" });

  return { speakers, words };
}
