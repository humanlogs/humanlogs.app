import { describe, expect, it } from "vitest";
import type { TranscriptionSegment } from "@/hooks/use-transcriptions";
import {
  ensureWordIndex,
  orderedRange,
  rangeToCharOffsets,
  stepSentence,
  stepToPunctuation,
  stepWord,
} from "@/components/transcriptions/editor/text/utils/segment-navigation";

/**
 * Keyboard movement over the flat projection.
 *
 * Coding an interview is done almost entirely from the keyboard, and the same keys
 * drive the transcript's navigate mode — so what "the next word" and "the end of the
 * sentence" mean has to be settled here rather than rediscovered in each hook.
 */

/** Build the projection the editor derives: word, spacing, word, … */
function build(text: string): TranscriptionSegment[] {
  const segments: TranscriptionSegment[] = [];
  for (const part of text.split(/(\s+)/)) {
    if (!part) continue;
    segments.push(
      /^\s+$/.test(part)
        ? { type: "spacing", text: part, speakerId: "speaker_0" }
        : { type: "word", text: part, speakerId: "speaker_0" },
    );
  }
  return segments;
}

// index: 0 Le  1 ␣  2 chat  3 ␣  4 dort.  5 ␣  6 Puis  7 ␣  8 il  9 ␣  10 part.
const LINE = build("Le chat dort. Puis il part.");

describe("stepWord", () => {
  it("skips the spacing between two words", () => {
    expect(stepWord(LINE, 0, "r")).toBe(2);
    expect(stepWord(LINE, 2, "l")).toBe(0);
  });

  it("clamps at both ends instead of running off", () => {
    expect(stepWord(LINE, 0, "l")).toBe(0);
    expect(stepWord(LINE, LINE.length - 1, "r")).toBe(LINE.length - 1);
  });
});

describe("stepSentence", () => {
  it("lands on the first word of the next sentence", () => {
    // The point of the jump is where you are going, not the full stop you left.
    expect(LINE[stepSentence(LINE, 0, "r")].text).toBe("Puis");
  });

  it("goes back to the start of the previous one", () => {
    expect(LINE[stepSentence(LINE, 8, "l")].text).toBe("Puis");
  });

  it("stops at the document's edges", () => {
    expect(stepSentence(LINE, 0, "l")).toBe(0);
    expect(LINE[stepSentence(LINE, 10, "r")].text).toBe("part.");
  });
});

describe("stepToPunctuation", () => {
  it("selects up to the punctuation, including it", () => {
    // Shift+Down means "take this clause"; stopping one word short would need
    // correcting every single time.
    expect(LINE[stepToPunctuation(LINE, 0, "r")].text).toBe("dort.");
  });

  it("moves on when pressed again from a boundary", () => {
    const first = stepToPunctuation(LINE, 0, "r");
    expect(LINE[stepToPunctuation(LINE, first, "r")].text).toBe("part.");
  });

  it("works backwards", () => {
    expect(LINE[stepToPunctuation(LINE, 10, "l")].text).toBe("dort.");
  });

  it("reaches the end when the passage has no punctuation left", () => {
    const plain = build("un deux trois");
    expect(plain[stepToPunctuation(plain, 0, "r")].text).toBe("trois");
  });

  it("treats a long pause as a boundary", () => {
    // Transcripts routinely run on without punctuation; a silence is the only
    // sentence boundary some passages have. The pause itself is not selected — the
    // word before it is.
    const paused = build("un deux trois");
    paused[3] = { ...paused[3], start: 1, end: 4 };
    expect(paused[stepToPunctuation(paused, 0, "r")].text).toBe("deux");
  });
});

describe("ranges", () => {
  it("orders an anchor/focus pair either way round", () => {
    expect(orderedRange(2, 6)).toEqual({ from: 2, to: 6 });
    expect(orderedRange(6, 2)).toEqual({ from: 2, to: 6 });
  });

  it("converts a segment range into flat character offsets", () => {
    // "chat dort." — segments 2..4, i.e. after "Le ".
    expect(rangeToCharOffsets(LINE, { from: 2, to: 4 })).toEqual({
      start: 3,
      end: 13,
    });
  });
});

describe("ensureWordIndex", () => {
  it("snaps a spacing onto a word in the direction of travel", () => {
    expect(ensureWordIndex(1, LINE, "r")).toBe(2);
    expect(ensureWordIndex(1, LINE, "l")).toBe(0);
  });
});
