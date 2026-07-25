import * as Y from "yjs";
import type {
  TranscriptionContent,
  TranscriptionSegment,
} from "@/hooks/use-transcriptions";
import { normalizeEditorSegments } from "../hooks/use-normalize-editor-segments";

/**
 * Yjs schema for the collaborative transcript editor (Architecture A — the token
 * IS the CRDT object with stable identity).
 *
 *   Y.Doc
 *   ├─ Y.Map   "speakers"   // speakerId -> Y.Map { name }
 *   └─ Y.Array "blocks"     // one block per speaker turn / paragraph
 *         block = Y.Map {
 *           speakerId: string,
 *           tokens: Y.Array<Y.Map { text, kind, start, end, mods, tags? }>
 *         }
 *
 * A block maps 1:1 to a `<p data-speaker-id>` paragraph. The paragraph boundary
 * between two blocks (`</p><p>`) counts as exactly 2 ProseMirror positions; on the
 * flat `TranscriptionSegment[]` projection that boundary is a synthetic 2-char
 * `\n\n` spacing (see {@link ydocToContent}). Keeping that equivalence is what makes
 * `PMpos === flatCharOffset + 1` hold everywhere.
 *
 * Field renames vs. the flat `TranscriptionSegment` model live here and ONLY here:
 *   segment.type      -> token "kind"    ("word" | "spacing")
 *   segment.modifiers -> token "mods"    (("b"|"i"|"u"|"s")[])
 */

// ---------------------------------------------------------------------------
// Types & accessors
// ---------------------------------------------------------------------------

export type TokenKind = "word" | "spacing";
export type Modifier = "b" | "i" | "u" | "s";

/** Plain-object view of a token (never the live Y.Map). */
export type TokenData = {
  text: string;
  kind: TokenKind;
  start: number | null;
  end: number | null;
  mods: Modifier[];
  tags?: string[];
};

export type YTokenMap = Y.Map<unknown>;
export type YBlockMap = Y.Map<unknown>;

export const BLOCKS_KEY = "blocks";
export const SPEAKERS_KEY = "speakers";

export function getBlocks(ydoc: Y.Doc): Y.Array<YBlockMap> {
  return ydoc.getArray<YBlockMap>(BLOCKS_KEY);
}

export function getSpeakers(ydoc: Y.Doc): Y.Map<Y.Map<unknown>> {
  return ydoc.getMap<Y.Map<unknown>>(SPEAKERS_KEY);
}

export function getBlockTokens(block: YBlockMap): Y.Array<YTokenMap> {
  return block.get("tokens") as Y.Array<YTokenMap>;
}

export function getBlockSpeakerId(block: YBlockMap): string {
  return (block.get("speakerId") as string) ?? "speaker_0";
}

/** Read the speakers map into the flat `{ id, name? }[]` list. */
export function readSpeakers(ydoc: Y.Doc): { id: string; name?: string }[] {
  const map = getSpeakers(ydoc);
  return [...map.keys()].map((id) => {
    const name = map.get(id)?.get("name") as string | undefined;
    return name != null ? { id, name } : { id };
  });
}

// ---------------------------------------------------------------------------
// Mappers: TranscriptionSegment <-> token
// ---------------------------------------------------------------------------

/** Plain (non-Yjs) view of a token. */
export function segToTokenData(seg: TranscriptionSegment): TokenData {
  const data: TokenData = {
    text: seg.text,
    kind: seg.type,
    start: seg.start ?? null,
    end: seg.end ?? null,
    mods: seg.modifiers ? [...seg.modifiers] : [],
  };
  const tags = (seg as TranscriptionSegment & { tags?: string[] }).tags;
  if (tags && tags.length) data.tags = [...tags];
  return data;
}

/** Build a fresh token Y.Map from a plain token view. */
export function newTokenMapFromData(data: TokenData): YTokenMap {
  const m = new Y.Map<unknown>();
  m.set("text", data.text);
  m.set("kind", data.kind);
  m.set("start", data.start);
  m.set("end", data.end);
  m.set("mods", [...data.mods]);
  if (data.tags && data.tags.length) m.set("tags", [...data.tags]);
  return m;
}

/** Build a fresh token Y.Map from a flat segment. */
export function newTokenMap(seg: TranscriptionSegment): YTokenMap {
  return newTokenMapFromData(segToTokenData(seg));
}

/** Read a token Y.Map into a plain segment, injecting the owning block's speaker. */
export function tokenToSeg(
  tok: YTokenMap,
  speakerId: string,
): TranscriptionSegment {
  const start = tok.get("start") as number | null;
  const end = tok.get("end") as number | null;
  const mods = tok.get("mods") as Modifier[] | undefined;
  const tags = tok.get("tags") as string[] | undefined;

  const seg: TranscriptionSegment = {
    type: tok.get("kind") as TokenKind,
    text: (tok.get("text") as string) ?? "",
  };
  if (start !== null && start !== undefined) seg.start = start;
  if (end !== null && end !== undefined) seg.end = end;
  if (speakerId) seg.speakerId = speakerId;
  if (mods && mods.length) seg.modifiers = [...mods];
  // `tags` is not part of TranscriptionSegment yet (Stage 5) — carried through
  // as an extra field so a round-trip never loses it.
  if (tags && tags.length)
    (seg as TranscriptionSegment & { tags?: string[] }).tags = [...tags];
  return seg;
}

// ---------------------------------------------------------------------------
// Block grouping (flat segments -> plain blocks)
// ---------------------------------------------------------------------------

/** Plain (non-Yjs) view of a block. */
export type PlainBlock = {
  speakerId: string;
  tokens: TokenData[];
};

/** Speaker of the nearest word at/after index `i`. */
function nextWordSpeaker(
  segments: TranscriptionSegment[],
  i: number,
  fallback: string,
): string {
  for (let j = i; j < segments.length; j++) {
    if (segments[j].type === "word") return segments[j].speakerId ?? fallback;
  }
  return fallback;
}

/**
 * Group a flat segment array into blocks (speaker turns / paragraphs). Each
 * paragraph boundary — a spacing that contains `\n\n` or separates two different
 * speakers — is *consumed* (dropped); it becomes the `</p><p>` break, reinserted as
 * a 2-char `\n\n` by {@link ydocToContent}. Mirrors the paragraph rule in
 * segmentsToHtml (html.ts:63-66). The input is normalized first.
 */
export function contentToBlocks(
  segments: TranscriptionSegment[],
  options?: { initialFormatting?: boolean },
): PlainBlock[] {
  const norm = normalizeEditorSegments(segments ?? [], options);
  const blocks: PlainBlock[] = [];
  if (norm.length === 0) return blocks;

  let cur: PlainBlock | null = null;
  let curSpeaker = norm[0].speakerId ?? "speaker_0";
  let forceNew = false;

  for (let i = 0; i < norm.length; i++) {
    const seg = norm[i];

    if (seg.type === "spacing") {
      const nextSpk = nextWordSpeaker(norm, i + 1, curSpeaker);
      const isBoundary =
        seg.text.includes("\n\n") || (cur !== null && nextSpk !== cur.speakerId);
      if (isBoundary) {
        forceNew = true; // drop the boundary spacing; next token opens a block
        continue;
      }
      if (!cur) {
        curSpeaker = seg.speakerId ?? curSpeaker;
        cur = { speakerId: curSpeaker, tokens: [] };
        blocks.push(cur);
        forceNew = false;
      }
      cur.tokens.push(segToTokenData(seg));
      continue;
    }

    // word
    const spk = seg.speakerId ?? curSpeaker;
    if (!cur || forceNew || spk !== cur.speakerId) {
      curSpeaker = spk;
      cur = { speakerId: spk, tokens: [] };
      blocks.push(cur);
      forceNew = false;
    }
    cur.tokens.push(segToTokenData(seg));
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// Seed: TranscriptionContent -> Y.Doc
// ---------------------------------------------------------------------------

/** Materialize a plain block into a fresh block Y.Map. */
export function newBlockMap(block: PlainBlock): YBlockMap {
  const b = new Y.Map<unknown>();
  b.set("speakerId", block.speakerId);
  const tokens = new Y.Array<YTokenMap>();
  if (block.tokens.length)
    tokens.push(block.tokens.map((t) => newTokenMapFromData(t)));
  b.set("tokens", tokens);
  return b;
}

/**
 * Populate an empty Y.Doc from stored transcription content. Idempotent: only seeds
 * when `blocks` is empty (first client wins).
 */
export function seedYDoc(
  content: TranscriptionContent,
  ydoc: Y.Doc,
  origin: unknown = "seed",
): void {
  const blocksArr = getBlocks(ydoc);
  if (blocksArr.length > 0) return;

  const plainBlocks = contentToBlocks(content.words ?? [], {
    initialFormatting: true,
  });

  ydoc.transact(() => {
    // Speakers map (+ backfill any speaker referenced by a block)
    const speakersMap = getSpeakers(ydoc);
    const seen = new Set<string>();
    for (const s of content.speakers ?? []) {
      const sm = new Y.Map<unknown>();
      if (s.name != null) sm.set("name", s.name);
      speakersMap.set(s.id, sm);
      seen.add(s.id);
    }
    for (const b of plainBlocks) {
      if (b.speakerId && !seen.has(b.speakerId)) {
        speakersMap.set(b.speakerId, new Y.Map<unknown>());
        seen.add(b.speakerId);
      }
    }

    if (plainBlocks.length === 0) {
      // Empty transcript: one empty block so the editor has a paragraph.
      const firstSpeaker = content.speakers?.[0]?.id ?? "speaker_0";
      blocksArr.push([newBlockMap({ speakerId: firstSpeaker, tokens: [] })]);
      return;
    }

    blocksArr.push(plainBlocks.map((b) => newBlockMap(b)));
  }, origin);
}

// ---------------------------------------------------------------------------
// Project: Y.Doc -> TranscriptionContent (the flat derived shape used everywhere)
// ---------------------------------------------------------------------------

/**
 * Flatten the Y.Doc back to the persisted/derived `TranscriptionContent`. Reinserts
 * a synthetic 2-char `\n\n` spacing between consecutive blocks (the paragraph
 * boundary), with `speakerId` = previous block ("before wins", matching
 * normalizeEditorSegments step 3) and interpolated start/end.
 */
export function ydocToContent(ydoc: Y.Doc): TranscriptionContent {
  const blocksArr = getBlocks(ydoc);
  const speakersMap = getSpeakers(ydoc);

  const words: TranscriptionSegment[] = [];

  for (let b = 0; b < blocksArr.length; b++) {
    const block = blocksArr.get(b);
    const speakerId = getBlockSpeakerId(block);
    const tokens = getBlockTokens(block);

    if (b > 0) {
      const prevSeg = words[words.length - 1];
      const prevSpeaker = getBlockSpeakerId(blocksArr.get(b - 1));
      const firstTok = tokens.length > 0 ? tokens.get(0) : undefined;
      const nextStart = firstTok
        ? (firstTok.get("start") as number | null)
        : null;
      const boundary: TranscriptionSegment = {
        type: "spacing",
        text: "\n\n",
        speakerId: prevSpeaker,
      };
      if (prevSeg?.end != null) boundary.start = prevSeg.end;
      if (nextStart != null) boundary.end = nextStart;
      words.push(boundary);
    }

    for (let t = 0; t < tokens.length; t++) {
      words.push(tokenToSeg(tokens.get(t), speakerId));
    }
  }

  const speakers = [...speakersMap.keys()].map((id) => {
    const sm = speakersMap.get(id);
    const name = sm?.get("name") as string | undefined;
    return name != null ? { id, name } : { id };
  });

  return { words, speakers };
}

// ---------------------------------------------------------------------------
// Timestamp invariant
// ---------------------------------------------------------------------------

/**
 * Deterministic, idempotent, order-independent repair of a token sequence's
 * timestamps: make `start`/`end` monotonic non-decreasing and interpolate any
 * `null` timestamps between the nearest bounded neighbours. Because it is a pure
 * function of the (already Yjs-converged) sequence, every client computes the same
 * corrections — no coordination needed.
 *
 * Operates in place on plain token views; callers write the diff back to Yjs
 * (gated by an epsilon in later stages to avoid write storms — Stage 4).
 */
export function enforceTimestampInvariant(
  tokens: Pick<TokenData, "start" | "end">[],
): void {
  const n = tokens.length;
  if (n === 0) return;

  // Pass 1 — interpolate nulls between nearest bounded neighbours.
  for (let i = 0; i < n; i++) {
    if (tokens[i].start != null && tokens[i].end != null) continue;

    // nearest bounded value before (prefer an `end`, else a `start`)
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
    // nearest bounded value after (prefer a `start`, else an `end`)
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
    if (lo == null || hi == null) continue; // no anchors at all — leave as-is
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
