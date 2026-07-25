import * as Y from "yjs";
import type { TranscriptionContent } from "@/hooks/use-transcriptions";
import {
  contentToBlocks,
  getBlocks,
  getBlockSpeakerId,
  getBlockTokens,
  getSpeakers,
  newBlockMap,
  newTokenMapFromData,
  type Modifier,
  type PlainBlock,
  type TokenData,
  type YBlockMap,
  type YTokenMap,
} from "./ydoc-schema";

/**
 * Reconcile a Y.Doc towards a target `TranscriptionContent`, writing the MINIMAL
 * set of token/block operations so that unchanged tokens keep their Yjs identity
 * (and therefore their timestamps, tags, and CRDT merge behaviour).
 *
 * This is the PM->Yjs bridge: the caller computes the desired flat state with the
 * existing, battle-tested `applyTransactionOnSegments` engine, then hands it here.
 * A single keystroke trims to a ~1-token diff; a same-count/same-kind 1:1 diff is
 * applied in place (preserving identity + start/end) — that is the common
 * "type a letter inside a word" path.
 *
 * All writes happen inside one `ydoc.transact(fn, origin)` so downstream observers
 * see exactly one update tagged with `origin`.
 */
export function reconcileYDoc(
  ydoc: Y.Doc,
  target: TranscriptionContent,
  origin: unknown,
): void {
  const targetBlocks = contentToBlocks(target.words ?? []);
  ydoc.transact(() => {
    reconcileSpeakers(ydoc, target);
    reconcileBlockArray(getBlocks(ydoc), targetBlocks);
  }, origin);
}

// ---------------------------------------------------------------------------
// Speakers
// ---------------------------------------------------------------------------

function reconcileSpeakers(ydoc: Y.Doc, target: TranscriptionContent): void {
  const map = getSpeakers(ydoc);
  const wanted = new Set<string>();
  for (const s of target.speakers ?? []) {
    wanted.add(s.id);
    let sm = map.get(s.id);
    if (!sm) {
      sm = new Y.Map<unknown>();
      map.set(s.id, sm);
    }
    if (s.name != null && sm.get("name") !== s.name) sm.set("name", s.name);
  }
  // Backfill speakers referenced by blocks but not in the list.
  for (const b of contentToBlocks(target.words ?? [])) {
    if (b.speakerId && !map.has(b.speakerId)) {
      wanted.add(b.speakerId);
      map.set(b.speakerId, new Y.Map<unknown>());
    }
  }
  // Note: we intentionally do NOT delete speakers that dropped out of the list —
  // removal is an explicit user action handled elsewhere, and keeping a stray
  // speaker entry is harmless (colors are derived by index at render time).
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

function reconcileBlockArray(
  yblocks: Y.Array<YBlockMap>,
  target: PlainBlock[],
): void {
  // Trim common prefix / suffix of structurally-identical blocks (untouched).
  let p = 0;
  while (
    p < yblocks.length &&
    p < target.length &&
    blockEquals(yblocks.get(p), target[p])
  )
    p++;

  let ye = yblocks.length;
  let te = target.length;
  while (
    ye > p &&
    te > p &&
    blockEquals(yblocks.get(ye - 1), target[te - 1])
  ) {
    ye--;
    te--;
  }

  // Overlapping middle range: reconcile in place (preserves block + token identity).
  const overlap = Math.min(ye - p, te - p);
  for (let k = 0; k < overlap; k++) {
    reconcileBlock(yblocks.get(p + k), target[p + k]);
  }

  // Extra live blocks -> delete; extra target blocks -> insert.
  const yMid = ye - (p + overlap); // remaining live blocks in the middle
  const tMid = te - (p + overlap); // remaining target blocks in the middle
  if (yMid > 0) yblocks.delete(p + overlap, yMid);
  if (tMid > 0) {
    const insertAt = p + overlap;
    const news = target.slice(insertAt, insertAt + tMid).map((b) => newBlockMap(b));
    yblocks.insert(insertAt, news);
  }
}

function reconcileBlock(yblock: YBlockMap, target: PlainBlock): void {
  if (getBlockSpeakerId(yblock) !== target.speakerId)
    yblock.set("speakerId", target.speakerId);
  reconcileTokenArray(getBlockTokens(yblock), target.tokens);
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

function reconcileTokenArray(
  ytokens: Y.Array<YTokenMap>,
  target: TokenData[],
): void {
  let p = 0;
  while (
    p < ytokens.length &&
    p < target.length &&
    tokenEquals(ytokens.get(p), target[p])
  )
    p++;

  let ye = ytokens.length;
  let te = target.length;
  while (ye > p && te > p && tokenEquals(ytokens.get(ye - 1), target[te - 1])) {
    ye--;
    te--;
  }

  const oldCount = ye - p;
  const newCount = te - p;

  if (
    oldCount === 1 &&
    newCount === 1 &&
    (ytokens.get(p).get("kind") as string) === target[p].kind
  ) {
    // In-place update: preserves token identity (and thus timestamps/tags on a
    // pure text edit). This is the hot "type inside a word" path.
    updateTokenInPlace(ytokens.get(p), target[p]);
    return;
  }

  if (oldCount > 0) ytokens.delete(p, oldCount);
  if (newCount > 0)
    ytokens.insert(
      p,
      target.slice(p, te).map((t) => newTokenMapFromData(t)),
    );
}

function updateTokenInPlace(ytok: YTokenMap, data: TokenData): void {
  if ((ytok.get("text") as string) !== data.text) ytok.set("text", data.text);
  if ((ytok.get("kind") as string) !== data.kind) ytok.set("kind", data.kind);
  if ((ytok.get("start") as number | null) !== data.start)
    ytok.set("start", data.start);
  if ((ytok.get("end") as number | null) !== data.end) ytok.set("end", data.end);
  if (!modsEqual(ytok.get("mods") as Modifier[] | undefined, data.mods))
    ytok.set("mods", [...data.mods]);
  const curTags = ytok.get("tags") as string[] | undefined;
  if (!arrEqual(curTags, data.tags)) {
    if (data.tags && data.tags.length) ytok.set("tags", [...data.tags]);
    else if (curTags) ytok.delete("tags");
  }
}

// ---------------------------------------------------------------------------
// Value equality
// ---------------------------------------------------------------------------

function tokenEquals(ytok: YTokenMap, data: TokenData): boolean {
  return (
    (ytok.get("text") as string) === data.text &&
    (ytok.get("kind") as string) === data.kind &&
    (ytok.get("start") as number | null) === data.start &&
    (ytok.get("end") as number | null) === data.end &&
    modsEqual(ytok.get("mods") as Modifier[] | undefined, data.mods) &&
    arrEqual(ytok.get("tags") as string[] | undefined, data.tags)
  );
}

function blockEquals(yblock: YBlockMap, block: PlainBlock): boolean {
  if (getBlockSpeakerId(yblock) !== block.speakerId) return false;
  const tokens = getBlockTokens(yblock);
  if (tokens.length !== block.tokens.length) return false;
  for (let i = 0; i < block.tokens.length; i++) {
    if (!tokenEquals(tokens.get(i), block.tokens[i])) return false;
  }
  return true;
}

function modsEqual(a: Modifier[] | undefined, b: Modifier[] | undefined): boolean {
  const aa = a ?? [];
  const bb = b ?? [];
  if (aa.length !== bb.length) return false;
  for (let i = 0; i < aa.length; i++) if (aa[i] !== bb[i]) return false;
  return true;
}

function arrEqual(a: string[] | undefined, b: string[] | undefined): boolean {
  const aa = a ?? [];
  const bb = b ?? [];
  if (aa.length !== bb.length) return false;
  for (let i = 0; i < aa.length; i++) if (aa[i] !== bb[i]) return false;
  return true;
}
