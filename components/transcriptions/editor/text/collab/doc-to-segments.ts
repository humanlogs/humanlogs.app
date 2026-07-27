import type { Node as PMNode } from "@tiptap/pm/model";
import type { TranscriptionSegment } from "@/hooks/use-transcriptions";
import { normalizeEditorSegments } from "../hooks/use-normalize-editor-segments";

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

/** Collect comment thread ids from a node's `comment` marks (usually 0 or 1). */
function marksToComments(node: PMNode): string[] | undefined {
  const ids: string[] = [];
  for (const m of node.marks) {
    if (m.type.name === "comment") {
      const id = m.attrs?.commentId as string | undefined;
      if (id && !ids.includes(id)) ids.push(id);
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
      out.push({ type: "spacing", text: part, speakerId });
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
 * Carry start/end from a timing `reference` onto `next` word tokens: common
 * prefix/suffix keep their exact reference timestamp, the middle is LCS-aligned so
 * unchanged (even scattered) words keep theirs, and only truly new/changed words are
 * interpolated by {@link enforceTimestampInvariant}. PURE and DETERMINISTIC — with a
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
  while (p < n && p < m && norm(nextWords[p].text) === norm(prevWords[p].text)) {
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
  // Middle (p .. n-s): LCS-align the remaining words so unchanged words keep their
  // exact reference timestamp even when edits are scattered; only truly new/changed
  // words are left null (interpolated below).
  const midNextIdx: number[] = [];
  const midPrevIdx: number[] = [];
  for (let i = p; i < n - s; i++) midNextIdx.push(i);
  for (let j = p; j < m - s; j++) midPrevIdx.push(j);

  // LCS is O(mid²) time AND memory — guard against a pathological changed region
  // (rare: huge scattered edits). Above the cap we skip it and let the whole middle
  // interpolate; the user accepts minor offsets there. Prefix/suffix stay exact.
  const LCS_CAP = 4_000_000; // ~2000 × 2000
  const matchedNext = new Set<number>();
  if (midNextIdx.length * midPrevIdx.length <= LCS_CAP) {
    for (const [a, b] of lcs(
      midNextIdx.map((i) => norm(nextWords[i].text)),
      midPrevIdx.map((j) => norm(prevWords[j].text)),
    )) {
      const ni = midNextIdx[a];
      const pj = midPrevIdx[b];
      nextWords[ni].start = prevWords[pj].start;
      nextWords[ni].end = prevWords[pj].end;
      matchedNext.add(ni);
    }
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
