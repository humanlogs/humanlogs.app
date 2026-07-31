import type { Node as PMNode } from "@tiptap/pm/model";
import type { TranscriptionSegment } from "@/hooks/use-transcriptions";
import { normalizeEditorSegments } from "../hooks/use-normalize-editor-segments";
import { parseCommentIds } from "../extensions/comment-mark";

/**
 * Deterministic, idempotent, order-independent repair of a token sequence's
 * timestamps: make `start`/`end` monotonic non-decreasing and interpolate any `null`
 * timestamps between the nearest bounded neighbours. Pure function of the (already
 * converged) sequence, so every client computes the same result.
 */
function enforceTimestampInvariant(
  tokens: { start: number | null; end: number | null }[],
): void {
  const n = tokens.length;
  if (n === 0) return;

  // Pass 1 — interpolate nulls between nearest bounded neighbours.
  for (let i = 0; i < n; i++) {
    if (tokens[i].start != null && tokens[i].end != null) continue;
    let before: number | null = null;
    for (let j = i - 1; j >= 0; j--) {
      if (tokens[j].end != null) {
        before = tokens[j].end;
        break;
      }
      if (tokens[j].start != null) {
        before = tokens[j].start;
        break;
      }
    }
    let after: number | null = null;
    for (let j = i + 1; j < n; j++) {
      if (tokens[j].start != null) {
        after = tokens[j].start;
        break;
      }
      if (tokens[j].end != null) {
        after = tokens[j].end;
        break;
      }
    }
    const lo = before ?? after;
    const hi = after ?? before;
    if (lo == null || hi == null) continue;
    if (tokens[i].start == null) tokens[i].start = lo;
    if (tokens[i].end == null) tokens[i].end = hi;
  }

  // Pass 2 — forward monotonicity: start >= previous end, end >= start.
  let lastEnd: number | null = null;
  for (let i = 0; i < n; i++) {
    const t = tokens[i];
    if (t.start != null && lastEnd != null && t.start < lastEnd) t.start = lastEnd;
    if (t.start != null && t.end != null && t.end < t.start) t.end = t.start;
    if (t.end != null) lastEnd = t.end;
    else if (t.start != null) lastEnd = t.start;
  }
}

/**
 * Derive the flat `TranscriptionSegment[]` projection from a ProseMirror document.
 *
 * With the standard TipTap Collaboration binding the Y.XmlFragment IS the document
 * (text, paragraph structure, speaker attrs, marks) — but audio sync, the speaker
 * UI, autosave, search, etc. all consume the flat segment array. This module
 * rebuilds that array from the (converged) doc: structure is read directly; per-word
 * start/end are carried over from the previous projection (unchanged prefix/suffix
 * keep exact timestamps, freshly-edited words interpolate). Deterministic given the
 * same doc + previous segments.
 */

const MARK_TO_MOD: Record<string, "b" | "i" | "u" | "s"> = {
  bold: "b",
  italic: "i",
  underline: "u",
  strike: "s",
};

function marksToMods(node: PMNode): ("b" | "i" | "u" | "s")[] | undefined {
  const mods: ("b" | "i" | "u" | "s")[] = [];
  for (const m of node.marks) {
    const mod = MARK_TO_MOD[m.type.name];
    if (mod && !mods.includes(mod)) mods.push(mod);
  }
  return mods.length ? mods : undefined;
}

/**
 * Collect comment thread ids from a node's `comment` mark. There is at most one such
 * mark (ProseMirror allows one per type), but it lists every thread covering the run,
 * so overlapping threads all land in the projection.
 */
function marksToComments(node: PMNode): string[] | undefined {
  const ids: string[] = [];
  for (const m of node.marks) {
    if (m.type.name !== "comment") continue;
    for (const id of parseCommentIds(m.attrs?.commentIds)) {
      if (!ids.includes(id)) ids.push(id);
    }
  }
  return ids.length ? ids : undefined;
}

/** Split a text run into word / spacing tokens, inheriting speaker + modifiers. */
function pushTextRun(
  out: TranscriptionSegment[],
  text: string,
  speakerId: string,
  modifiers: ("b" | "i" | "u" | "s")[] | undefined,
  comments: string[] | undefined,
) {
  if (!text) return;
  for (const part of text.split(/(\s+)/)) {
    if (!part) continue;
    if (/^\s+$/.test(part)) {
      // Whitespace inside a marked run belongs to the thread too — otherwise a
      // reloaded range comes back as one highlight per word instead of one band.
      out.push({
        type: "spacing",
        text: part,
        speakerId,
        ...(comments ? { comments } : {}),
      });
    } else {
      out.push({
        type: "word",
        text: part,
        speakerId,
        ...(modifiers ? { modifiers } : {}),
        ...(comments ? { comments } : {}),
      });
    }
  }
}

/** Extract structure-only segments (no timestamps) from the PM doc. */
function docToStructureSegments(doc: PMNode): TranscriptionSegment[] {
  const out: TranscriptionSegment[] = [];
  let firstParagraph = true;

  doc.forEach((block) => {
    if (block.type.name !== "paragraph") return;
    const speakerId = (block.attrs?.speakerId as string) || "speaker_0";

    // Paragraph boundary → 2-char "\n\n" spacing (mirrors the projection convention
    // and keeps PMpos == flatCharOffset + 1).
    if (!firstParagraph) {
      out.push({ type: "spacing", text: "\n\n", speakerId });
    }
    firstParagraph = false;

    block.forEach((inline) => {
      if (inline.isText) {
        pushTextRun(
          out,
          inline.text ?? "",
          speakerId,
          marksToMods(inline),
          marksToComments(inline),
        );
      } else if (inline.type.name === "hardBreak") {
        out.push({ type: "spacing", text: "\n", speakerId });
      }
    });
  });

  return out;
}

const norm = (w: string): string =>
  w.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, "");

/** Longest common subsequence → matched [indexInA, indexInB] pairs. O(m·n). */
function lcs(a: string[], b: string[]): [number, number][] {
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
  let i = m;
  let j = n;
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
}

/**
 * Exact LCS is O(m·n) in time AND memory, so it can only run on a bounded region
 * (~1000×1000). Ranges above the cap are split first — see {@link alignRange}.
 */
const LCS_CAP = 1_000_000;
/** Candidates probed around the middle when looking for a split anchor. */
const ANCHOR_PROBES = 256;
/** Belt-and-braces guard on the divide-and-conquer recursion. */
const MAX_SPLIT_DEPTH = 64;

/** Index of every occurrence of each token, ascending. */
function indexOccurrences(tokens: string[]): Map<string, number[]> {
  const index = new Map<string, number[]>();
  for (let i = 0; i < tokens.length; i++) {
    const list = index.get(tokens[i]);
    if (list) list.push(i);
    else index.set(tokens[i], [i]);
  }
  return index;
}

/** Occurrence closest to `center` within `[lo, hi]`, or -1. `occ` is ascending. */
function closestOccurrence(
  occ: number[],
  center: number,
  lo: number,
  hi: number,
): number {
  let left = 0;
  let right = occ.length;
  while (left < right) {
    const mid = (left + right) >> 1;
    if (occ[mid] < center) left = mid + 1;
    else right = mid;
  }
  let best = -1;
  // `left` is the first occurrence >= center; the answer is it or its predecessor,
  // walking outwards past any occurrence that falls outside [lo, hi].
  for (let k = left; k < occ.length; k++) {
    if (occ[k] > hi) break;
    if (occ[k] >= lo) {
      best = occ[k];
      break;
    }
  }
  for (let k = left - 1; k >= 0; k--) {
    if (occ[k] < lo) break;
    if (occ[k] <= hi) {
      if (best === -1 || center - occ[k] < best - center) best = occ[k];
      break;
    }
  }
  return best;
}

/**
 * Pick a split point for a region too large for the exact DP: a token near the
 * middle of `a` matched to its closest occurrence in `b`.
 *
 * "Closest" is measured against the proportional diagonal, and only accepted inside
 * a window wide enough to absorb the drift the two sides can have accumulated
 * (`|m - n|` at minimum). Transcripts repeat their words, so requiring a *unique*
 * anchor (patience-diff style) finds nothing on a long interview — the nearest
 * occurrence is the right one as long as it is searched for near where it should be.
 */
function findSplitAnchor(
  a: string[],
  b: string[],
  aLo: number,
  aHi: number,
  bLo: number,
  bHi: number,
  bIndex: Map<string, number[]>,
): [number, number] | null {
  const m = aHi - aLo;
  const n = bHi - bLo;
  const window = Math.max(512, Math.abs(m - n) + 256);
  const middle = aLo + (m >> 1);
  const probes = Math.min(m, ANCHOR_PROBES);

  for (let k = 0; k < probes; k++) {
    // Alternate right/left of the middle so the split stays balanced.
    const i = k % 2 === 0 ? middle + (k >> 1) : middle - ((k + 1) >> 1);
    if (i < aLo || i >= aHi) continue;
    const token = a[i];
    if (!token) continue; // punctuation-only token: normalizes to "", matches anything
    const occ = bIndex.get(token);
    if (!occ) continue;
    const center = bLo + Math.round(((i - aLo) * n) / m);
    const j = closestOccurrence(occ, center, bLo, bHi - 1);
    if (j === -1 || Math.abs(j - center) > window) continue;
    return [i, j];
  }
  return null;
}

/**
 * Align `a[aLo, aHi)` with `b[bLo, bHi)`, appending matched index pairs to `out`.
 *
 * Common prefix/suffix are trimmed, a small enough remainder is aligned exactly by
 * {@link lcs}, and anything larger is split on an anchor and recursed into. That
 * last step is what keeps the alignment exact when a document is edited *all over*
 * — a replace-all, typically — instead of surrendering the whole region to
 * interpolation because the quadratic DP would not fit.
 */
function alignRange(
  a: string[],
  b: string[],
  aLo: number,
  aHi: number,
  bLo: number,
  bHi: number,
  bIndex: Map<string, number[]>,
  out: [number, number][],
  depth: number,
): void {
  while (aLo < aHi && bLo < bHi && a[aLo] === b[bLo]) out.push([aLo++, bLo++]);
  while (aHi > aLo && bHi > bLo && a[aHi - 1] === b[bHi - 1])
    out.push([--aHi, --bHi]);

  const m = aHi - aLo;
  const n = bHi - bLo;
  if (m === 0 || n === 0) return;

  if (m * n <= LCS_CAP) {
    for (const [i, j] of lcs(a.slice(aLo, aHi), b.slice(bLo, bHi)))
      out.push([aLo + i, bLo + j]);
    return;
  }

  const anchor =
    depth < MAX_SPLIT_DEPTH
      ? findSplitAnchor(a, b, aLo, aHi, bLo, bHi, bIndex)
      : null;
  // No anchor at all → the two sides share nothing here; leave the region to
  // interpolation rather than spending O(m·n) proving it.
  if (!anchor) return;

  const [i, j] = anchor;
  alignRange(a, b, aLo, i, bLo, j, bIndex, out, depth + 1);
  out.push([i, j]);
  alignRange(a, b, i + 1, aHi, j + 1, bHi, bIndex, out, depth + 1);
}

/**
 * Carry start/end from a timing `reference` onto `next` word tokens: common
 * prefix/suffix keep their exact reference timestamp, the middle goes through
 * {@link alignRange} so unchanged (even scattered) words keep theirs, and only truly
 * new/changed words are interpolated by
 * {@link enforceTimestampInvariant}. PURE and DETERMINISTIC — with a
 * shared reference + the converged doc, every client derives identical timestamps.
 */
function carryTimestamps(
  next: TranscriptionSegment[],
  prev: TranscriptionSegment[],
): void {
  const nextWords = next.filter((s) => s.type === "word");
  const prevWords = prev.filter((s) => s.type === "word");
  const n = nextWords.length;
  const m = prevWords.length;

  let p = 0;
  while (
    p < n &&
    p < m &&
    norm(nextWords[p].text) === norm(prevWords[p].text)
  ) {
    nextWords[p].start = prevWords[p].start;
    nextWords[p].end = prevWords[p].end;
    p++;
  }
  let s = 0;
  while (
    s < n - p &&
    s < m - p &&
    norm(nextWords[n - 1 - s].text) === norm(prevWords[m - 1 - s].text)
  ) {
    nextWords[n - 1 - s].start = prevWords[m - 1 - s].start;
    nextWords[n - 1 - s].end = prevWords[m - 1 - s].end;
    s++;
  }
  // Middle (p .. n-s): align the remaining words so unchanged words keep their exact
  // reference timestamp even when edits are scattered over the whole document (a
  // replace-all); only truly new/changed words are left null (interpolated below).
  const midNextIdx: number[] = [];
  const midPrevIdx: number[] = [];
  for (let i = p; i < n - s; i++) midNextIdx.push(i);
  for (let j = p; j < m - s; j++) midPrevIdx.push(j);

  const midNext = midNextIdx.map((i) => norm(nextWords[i].text));
  const midPrev = midPrevIdx.map((j) => norm(prevWords[j].text));
  const pairs: [number, number][] = [];
  alignRange(
    midNext,
    midPrev,
    0,
    midNext.length,
    0,
    midPrev.length,
    indexOccurrences(midPrev),
    pairs,
    0,
  );

  const matchedNext = new Set<number>();
  for (const [a, b] of pairs) {
    const ni = midNextIdx[a];
    const pj = midPrevIdx[b];
    nextWords[ni].start = prevWords[pj].start;
    nextWords[ni].end = prevWords[pj].end;
    matchedNext.add(ni);
  }
  for (const i of midNextIdx) {
    if (!matchedNext.has(i)) {
      nextWords[i].start = undefined;
      nextWords[i].end = undefined;
    }
  }

  // Interpolate the gaps and enforce monotonicity across all words.
  const holder = nextWords.map((w) => ({
    start: w.start ?? null,
    end: w.end ?? null,
  }));
  enforceTimestampInvariant(holder);
  for (let i = 0; i < n; i++) {
    nextWords[i].start = holder[i].start ?? undefined;
    nextWords[i].end = holder[i].end ?? undefined;
  }
}

/**
 * Full derivation: structure from the doc + timestamps carried from the shared timing
 * `reference` (pinned once in the Y.Doc, identical on every client), then normalized.
 * Because it is a pure function of (converged doc, shared reference), all clients
 * derive the SAME per-word timestamps → they converge without per-word CRDT storage.
 */
export function docToSegments(
  doc: PMNode,
  reference: TranscriptionSegment[] | null | undefined,
): TranscriptionSegment[] {
  const structure = docToStructureSegments(doc);
  if (reference && reference.length) carryTimestamps(structure, reference);
  // Canonicalize (merge spacings, spacing start/end from neighbours) WITHOUT the
  // initialFormatting paragraph-splitting pass (that runs only at seed time).
  return normalizeEditorSegments(structure);
}
