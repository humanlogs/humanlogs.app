import type { TranscriptionSegment } from "@/hooks/use-transcriptions";

/**
 * Moving through the flat segment projection with the keyboard.
 *
 * Extracted from `use-navigation-mode` so the rules can be stated once and tested
 * without an editor: navigate mode drives the transcript, and the coding phase drives
 * a *selection* over the same projection with the same keys, so the two must agree on
 * what "the next word" and "the end of the sentence" mean.
 *
 * Keys, as of the coding phase:
 *  - arrows          → one word (selection collapses)
 *  - Ctrl + arrows   → one sentence (this used to be Shift, which selection now needs)
 *  - Shift + ←/→     → grow or shrink the selection by one word
 *  - Shift + ↑/↓     → grow or shrink it to the next / previous punctuation
 */

/** Anything that ends a sentence, wherever it sits in the token. */
const SENTENCE_END = /[.!?…]/;

export function segmentDuration(segment: TranscriptionSegment): number {
  if (!segment?.start || !segment?.end) return 0;
  return segment.end - segment.start;
}

/**
 * A silence long enough to read as a break. Transcripts routinely run on without
 * punctuation, so a pause is the only sentence boundary some passages have.
 */
export function isBreak(segment: TranscriptionSegment | undefined): boolean {
  if (!segment) return false;
  if (SENTENCE_END.test(segment.text)) return true;
  return segment.type === "spacing" && segmentDuration(segment) > 1;
}

/**
 * Snap an index onto a word (or a long pause, which navigate mode treats as one),
 * searching in `direction`. Out-of-range indices clamp rather than fail — callers add
 * and subtract freely and let this settle the result.
 */
export function ensureWordIndex(
  index: number,
  segments: TranscriptionSegment[],
  direction: "r" | "l",
): number {
  let i = index;
  while (
    segments[i] &&
    !(segments[i].type === "word" || segmentDuration(segments[i]) > 1)
  ) {
    i += direction === "r" ? 1 : -1;
  }
  return Math.max(0, Math.min(segments.length - 1, i));
}

/** The next / previous word, one step away. */
export function stepWord(
  segments: TranscriptionSegment[],
  index: number,
  direction: "r" | "l",
): number {
  if (segments.length === 0) return 0;
  const target = index + (direction === "r" ? 1 : -1);
  return ensureWordIndex(target, segments, direction);
}

/**
 * The first word of the next sentence, or of the previous one — the jump Ctrl+arrow
 * makes. Walks to the next sentence boundary, then forward onto the word that follows
 * it: landing on the punctuation itself would leave the reader at the end of what they
 * just read rather than at the start of what comes next.
 */
export function stepSentence(
  segments: TranscriptionSegment[],
  index: number,
  direction: "r" | "l",
): number {
  if (segments.length === 0) return 0;

  let boundary = index;
  if (direction === "r") {
    let found = false;
    for (let i = index + 1; i < segments.length; i++) {
      if (isBreak(segments[i])) {
        boundary = i;
        found = true;
        break;
      }
    }
    if (!found) return ensureWordIndex(segments.length - 1, segments, "l");
  } else {
    let found = false;
    // Three tokens back, not one: the caret usually sits just after a boundary
    // (word, spacing, punctuation), and starting at index-1 would find that same
    // boundary again and never move.
    for (let i = index - 3; i >= 0; i--) {
      if (isBreak(segments[i])) {
        boundary = i;
        found = true;
        break;
      }
    }
    if (!found) return ensureWordIndex(0, segments, "r");
  }

  for (let i = boundary + 1; i < segments.length; i++) {
    if (segments[i].type === "word") return i;
  }
  return ensureWordIndex(boundary, segments, "l");
}

/**
 * The last word of the current sentence in `direction` — where Shift+↓ / Shift+↑ take
 * the moving end of the selection.
 *
 * Unlike {@link stepSentence} this STOPS on the punctuation-bearing word instead of
 * stepping past it: the point of the key is to select a whole clause, and a selection
 * that ran into the next sentence's first word would have to be shrunk back every time.
 * Repeating it therefore has to move on, so a token that already ends a sentence is
 * skipped before the search starts.
 */
export function stepToPunctuation(
  segments: TranscriptionSegment[],
  index: number,
  direction: "r" | "l",
): number {
  if (segments.length === 0) return 0;
  const stride = direction === "r" ? 1 : -1;

  let i = index + stride;
  // Already sitting on a boundary (a repeat press): step over it and its trailing
  // whitespace, or the search below would answer with the same word again.
  while (segments[i] && isBreak(segments[i]) && segments[i].type !== "word") {
    i += stride;
  }

  for (; i >= 0 && i < segments.length; i += stride) {
    if (isBreak(segments[i])) {
      // The punctuation belongs to the sentence being selected when it is part of a
      // word ("conclusion."); a bare pause does not, so we take the word beside it.
      return segments[i].type === "word"
        ? i
        : ensureWordIndex(i - stride, segments, direction === "r" ? "l" : "r");
    }
  }
  return ensureWordIndex(
    direction === "r" ? segments.length - 1 : 0,
    segments,
    direction === "r" ? "l" : "r",
  );
}

/** A selection over the projection, as a pair of segment indices (both inclusive). */
export type SegmentRange = { from: number; to: number };

/** Order an anchor/focus pair into a range. */
export function orderedRange(anchor: number, focus: number): SegmentRange {
  return anchor <= focus
    ? { from: anchor, to: focus }
    : { from: focus, to: anchor };
}

/**
 * The flat character offsets a segment range covers, as ProseMirror wants them.
 *
 * The projection is a flat string, and PM positions are that offset plus one (see
 * collab/doc-to-segments) — the +1 is applied by the caller, which is the only place
 * that knows it is talking to the editor.
 */
export function rangeToCharOffsets(
  segments: TranscriptionSegment[],
  range: SegmentRange,
): { start: number; end: number } {
  let start = 0;
  for (let i = 0; i < range.from && i < segments.length; i++) {
    start += segments[i].text.length;
  }
  let end = start;
  for (let i = range.from; i <= range.to && i < segments.length; i++) {
    end += segments[i].text.length;
  }
  return { start, end };
}
