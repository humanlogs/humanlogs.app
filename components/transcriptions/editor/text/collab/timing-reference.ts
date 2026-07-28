import type { TranscriptionSegment } from "@/hooks/use-transcriptions";

/**
 * The two decisions that keep per-word audio positions alive across a session.
 *
 * Timestamps are not stored in the CRDT: {@link docToSegments} carries them from a
 * reference, and the reference is pinned in the Y.Doc so every client derives the
 * same values. That makes the reference a single point of failure — lose it once
 * and every word in the room loses its place in the audio until a reload.
 *
 * It was lost like this: the projection is debounced, so it can run while the
 * document is still empty (the seed has not happened yet, or we are waiting on a
 * peer's state that never comes because the room's authority is a socket from the
 * page we just reloaded). That derivation produced an empty projection, which
 * overwrote the loaded segments, which the seed then pinned as the shared
 * reference. Everything downstream was consistent — and every word was at t=0.
 *
 * Both helpers below therefore test for CONTENT, never for null: an empty array is
 * a perfectly valid projection and a perfectly valid Y.Map value, and that is
 * exactly what makes it dangerous here.
 */

/** First reference that actually carries words: shared, then current, then loaded. */
export function chooseTimingReference(
  shared: TranscriptionSegment[] | null | undefined,
  current: TranscriptionSegment[] | null | undefined,
  initial: TranscriptionSegment[],
): TranscriptionSegment[] {
  if (shared?.length) return shared;
  if (current?.length) return current;
  return initial;
}

/**
 * Whether a derivation is the projection of a document that has not arrived yet,
 * rather than of one the user emptied. Such a projection must neither be saved nor
 * kept: it is indistinguishable from the real thing once stored.
 *
 * Emptying a document by hand stays possible — that goes through a local edit.
 */
export function isUnsyncedBlank(
  derived: TranscriptionSegment[],
  opts: { hadInitialContent: boolean; localEdits: boolean },
): boolean {
  return derived.length === 0 && opts.hadInitialContent && !opts.localEdits;
}
