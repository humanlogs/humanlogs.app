// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { TranscriptionSegment } from "@/hooks/use-transcriptions";

/** Normalize a word for matching: lowercase, strip leading/trailing punctuation. */
const normalize = (word: string): string =>
  word.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, "");

/**
 * Longest Common Subsequence on two string arrays.
 * Returns a list of [indexInA, indexInB] pairs for matched elements.
 */
const lcs = (a: string[], b: string[]): [number, number][] => {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0),
  );

  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);

  const pairs: [number, number][] = [];
  let i = m,
    j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      pairs.unshift([i - 1, j - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return pairs;
};

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Given the original word segments and a replacement segment (unsegmented text),
 * produces a new array of TranscriptionSegments with the best possible timestamps
 * assigned to each replacement word.
 *
 * - Anchor words (matched via LCS) keep the original timestamps and modifiers exactly.
 * - Changed words between anchors get timestamps linearly interpolated between
 *   the surrounding anchor boundaries.
 * - Spacing tokens are preserved character-for-character from the replacement text,
 *   with no timestamps assigned.
 */
export const matchTimestampsToReplacement = (
  originalSegments: TranscriptionSegment[],
  replacementSegment: TranscriptionSegment,
): TranscriptionSegment[] => {
  const speakerId = replacementSegment.speakerId;

  // --- 1. Tokenize replacement text into word/spacing segments ---------------

  const replacementTokens: TranscriptionSegment[] = replacementSegment.text
    .split(/(\s+)/)
    .filter((t) => t.length > 0)
    .map((text) => ({
      type: /^\s+$/.test(text) ? "spacing" : "word",
      text,
      speakerId,
    }));

  // Extract only word tokens for diffing (keep their indices into replacementTokens)
  const replacementWordIndices: number[] = replacementTokens
    .map((t, i) => (t.type === "word" ? i : -1))
    .filter((i) => i !== -1);

  const replacementWords = replacementWordIndices.map(
    (i) => replacementTokens[i],
  );

  // --- 2. Extract original word segments -------------------------------------

  const originalWords = originalSegments.filter((s) => s.type === "word");

  // --- 3. LCS on normalized forms to find anchors ----------------------------

  const normOriginal = originalWords.map((s) => normalize(s.text));
  const normReplacement = replacementWords.map((s) => normalize(s.text));

  // anchorMap: replacementWord index -> originalWord index
  // LCS returns [origIdx, repIdx], so swap to [repIdx, origIdx] for the Map
  const lcsPairs = lcs(normOriginal, normReplacement);
  const anchorMap = new Map<number, number>(
    lcsPairs.map(([origIdx, repIdx]) => [repIdx, origIdx]),
  );

  // --- 4. Assign timestamps to replacement word tokens -----------------------
  //
  // Walk the replacement words in order. For each changed span (words between
  // two anchors), interpolate timestamps linearly between the surrounding
  // anchor boundaries.
  //
  // Boundary cases:
  //   - Leading span (before first anchor):  all words get the first anchor's start
  //   - Trailing span (after last anchor):   all words get the last anchor's end

  const anchorEntries = [...anchorMap.entries()].sort(([a], [b]) => a - b);

  // Build a lookup: replacementWord index -> assigned segment
  const assignedWords: TranscriptionSegment[] = replacementWords.map((w) => ({
    ...w,
  }));

  // Apply anchor timestamps and modifiers first
  for (const [repIdx, origIdx] of anchorEntries) {
    const orig = originalWords[origIdx];
    assignedWords[repIdx] = {
      ...assignedWords[repIdx],
      start: orig.start,
      end: orig.end,
      modifiers: orig.modifiers ? [...orig.modifiers] : undefined,
    };
  }

  // Interpolate changed spans.
  // We iterate over spans between consecutive anchors (plus virtual sentinels
  // at each end), collecting the non-anchor words in each gap and distributing
  // their timestamps evenly between the surrounding anchor boundaries.
  const anchorRepIndices = anchorEntries.map(([repIdx]) => repIdx);

  const SENTINEL_START = -1;
  const SENTINEL_END = replacementWords.length;
  const boundaries = [SENTINEL_START, ...anchorRepIndices, SENTINEL_END];

  for (let b = 0; b < boundaries.length - 1; b++) {
    const prevBoundary = boundaries[b];
    const nextBoundary = boundaries[b + 1];

    // Collect the non-anchor word indices in this span
    const spanIndices: number[] = [];
    for (let idx = prevBoundary + 1; idx < nextBoundary; idx++) {
      if (!anchorMap.has(idx)) spanIndices.push(idx);
    }
    if (spanIndices.length === 0) continue;

    // Resolve time boundaries:
    //   - Leading span: both bounds come from the first anchor's start
    //   - Trailing span: both bounds come from the last anchor's end
    //   - Normal span: tStart = prevAnchor.end, tEnd = nextAnchor.start
    const tStart: number | undefined =
      prevBoundary === SENTINEL_START
        ? assignedWords[nextBoundary]?.start
        : assignedWords[prevBoundary].end;

    const tEnd: number | undefined =
      nextBoundary === SENTINEL_END
        ? assignedWords[prevBoundary]?.end
        : assignedWords[nextBoundary].start;

    if (tStart === undefined || tEnd === undefined) continue;

    const n = spanIndices.length;
    const step = (tEnd - tStart) / n;

    for (let k = 0; k < n; k++) {
      assignedWords[spanIndices[k]] = {
        ...assignedWords[spanIndices[k]],
        start: tStart + k * step,
        end: tStart + (k + 1) * step,
        modifiers: undefined,
      };
    }
  }

  // --- 5. Re-interleave spacing tokens ---------------------------------------

  return replacementTokens.map((token, tokenIdx) => {
    if (token.type === "spacing") return token;
    const wordPos = replacementWordIndices.indexOf(tokenIdx);
    return assignedWords[wordPos];
  });
};
